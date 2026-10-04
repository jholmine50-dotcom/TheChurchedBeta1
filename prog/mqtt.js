/* cliente MQTT mínimo (WebSocket) — extraído do palco */
(function(){

const BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const ENCODER=new TextEncoder();
const DECODER=new TextDecoder();

function bytesOf(parts){
  let n=0;for(let i=0;i<parts.length;i++)n+=parts[i].length;
  const out=new Uint8Array(n);let o=0;
  for(let i=0;i<parts.length;i++){out.set(parts[i],o);o+=parts[i].length}
  return out;
}
function mqttStr(s){
  const b=ENCODER.encode(s);const o=new Uint8Array(2+b.length);
  o[0]=(b.length>>8)&255;o[1]=b.length&255;o.set(b,2);return o;
}
function mqttVar(n){
  const a=[];do{let d=n%128;n=(n-d)/128;if(n>0)d|=128;a.push(d)}while(n>0);
  return Uint8Array.from(a);
}
function mqttPacket(type,flags,body){
  const v=mqttVar(body.length);const h=new Uint8Array(1+v.length);
  h[0]=((type<<4)|(flags&15))&255;h.set(v,1);return bytesOf([h,body]);
}
function readStr(buf,off){
  const len=(buf[off]<<8)|buf[off+1];
  return [DECODER.decode(buf.subarray(off+2,off+2+len)),off+2+len];
}

class MqttClient{
  constructor(){
    this.ws=null;this.buf=new Uint8Array(0);this.state='off';
    this.broker=0;this.opts=null;this.retry=0;this.ready=false;
    this.pingTimer=0;this.reTimer=0;this.hsTimer=0;this.lastIn=0;
  }
  start(opts){
    this.opts=opts;this.retry=0;this._open();
  }
  _open(){
    const url=BROKERS[this.broker];
    this.state='connecting';this.ready=false;
    this._emit('connecting',url);
    let ws;
    try{ws=new WebSocket(url,'mqtt')}catch(e){this._schedule('no-ws');return}
    this.ws=ws;this.buf=new Uint8Array(0);
    ws.binaryType='arraybuffer';
    this.lastIn=Date.now();
    ws.onopen=()=>{
      this.lastIn=Date.now();
      const will={
        topic:this.opts.will?this.opts.will.topic:'',
        payload:this.opts.will?JSON.stringify(this.opts.will.payload):''
      };
      const flags=0x02|(this.opts.will?0x04:0x00);
      const vh=bytesOf([mqttStr('MQTT'),Uint8Array.of(4),Uint8Array.of(flags),Uint8Array.of(0,30)]);
      const body=bytesOf([vh]);
      const parts=[body];
      parts.push(mqttStr(this._clientId()));
      if(this.opts.will){parts.push(mqttStr(will.topic),mqttStr(will.payload))}
      this._sendRaw(mqttPacket(1,0,bytesOf(parts)));
    };
    ws.onmessage=(ev)=>{
      this.lastIn=Date.now();
      this._feed(new Uint8Array(ev.data));
    };
    ws.onerror=()=>{};
    ws.onclose=()=>{if(!this.ready)this._schedule('closed');else this._drop('closed')};
    clearTimeout(this.hsTimer);
    this.hsTimer=setTimeout(()=>{if(!this.ready){try{ws.close()}catch(e){};this._schedule('timeout')}},9000);
  }
  _clientId(){
    if(!this._cid)this._cid='pf'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    return this._cid;
  }
  _emit(state,info){if(this.opts&&this.opts.onState)this.opts.onState(state,info||'')}
  _sendRaw(bytes){
    if(!this.ws||this.ws.readyState!==1)return false;
    try{this.ws.send(bytes);return true}catch(e){return false}
  }
  _schedule(reason){
    this.state='wait';this.ready=false;
    clearInterval(this.pingTimer);
    clearTimeout(this.reTimer);
    if(this.opts&&this.opts.onState)this.opts.onState('wait',reason);
    if(!this._lastReady)this.broker=(this.broker+1)%BROKERS.length;
    this._lastReady=false;
    const delay=Math.min(15000,1000*Math.pow(2,this.retry++));
    this.reTimer=setTimeout(()=>this._open(),delay);
  }
  _drop(reason){
    clearTimeout(this.hsTimer);
    try{this.ws.close()}catch(e){}
    this._schedule(reason);
  }
  _ping(){
    this._sendRaw(Uint8Array.of(0xC0,0x00));
    if(Date.now()-this.lastIn>50000)this._drop('stalled');
  }
  _feed(bytes){
    this.buf=bytesOf([this.buf,bytes]);
    for(;;){
      if(this.buf.length<2)return;
      let value=0,mult=1,i=1,lenBytes=0,more=true;
      while(more){
        if(i>=this.buf.length)return;
        const d=this.buf[i++];
        value+=(d&127)*mult;mult*=128;lenBytes++;
        if((d&128)===0)more=false;
        if(lenBytes>4){this._drop('bad-varint');return}
      }
      const total=i+value;
      if(this.buf.length<total)return;
      const type=(this.buf[0]>>4)&15,flags=this.buf[0]&15;
      const body=this.buf.subarray(i,total);
      this.buf=this.buf.subarray(total);
      this._dispatch(type,flags,body);
    }
  }
  _dispatch(type,flags,body){
    if(type===2){
      clearTimeout(this.hsTimer);
      const rc=body.length>1?body[1]:1;
      if(rc!==0){this._drop('connack-'+rc);return}
      this.ready=true;this._lastReady=true;this.retry=0;this.state='ready';
      if(this.opts.topics&&this.opts.topics.length){
        const subs=this.opts.topics.map(t=>bytesOf([mqttStr(t),Uint8Array.of(0)]));
        this._sendRaw(mqttPacket(8,2,bytesOf([Uint8Array.of(0,1)].concat(subs))));
      }
      clearInterval(this.pingTimer);
      this.pingTimer=setInterval(()=>this._ping(),15000);
      this._emit('ready',BROKERS[this.broker]);
      if(this.opts.onReady)this.opts.onReady();
      return;
    }
    if(type===3){
      const r=readStr(body,0);let off=r[1];
      const qos=(flags>>1)&3;
      let pid=null;
      if(qos>0){pid=body.subarray(off,off+2);off+=2}
      const payload=body.subarray(off);
      if(qos===1&&pid)this._sendRaw(mqttPacket(4,0,pid));
      let text='';
      try{text=DECODER.decode(payload)}catch(e){return}
      if(this.opts.onMessage)this.opts.onMessage(r[0],text,(flags&1)===1);
      return;
    }
    if(type===13)return;
  }
  publish(topic,payload,retain){
    const body=bytesOf([mqttStr(topic),ENCODER.encode(payload)]);
    return this._sendRaw(mqttPacket(3,retain?1:0,body));
  }
}

window.PFMqtt=MqttClient;
})();
