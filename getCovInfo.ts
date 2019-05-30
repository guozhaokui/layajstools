
import fs = require('fs');
import path = require('path');

class meminfo{
    id:number=0;
    name:string;
    pos:number;
    end:number;
    bodystart:number;// { 所在位置
    del=false;
    constructor(n:string,p:number,e:number,bp:number){
        this.name=n;
        this.pos=p;
        this.end=e;
        this.bodystart=bp;
    }
}

class ClassInfo{
    name:string;
    packageclass:string;
    pos:number;
    end:number;
    alldel=false;
    hasdel=false;   // 有任何删除的都为true，便于快速排除
    mems:meminfo[]; // 不能区分静态，否则顺序就错了。
    //staticMems:meminfo[];
    constructor(name:string,p:number,e:number){
        this.name=name;
        this.pos=p;
        this.end=e;
    }

    delfunc(f:string){
        for( let i=0; i<this.mems.length; i++){
            let sm = this.mems[i];
            if(sm.name==f){
                sm.del=true;
                this.hasdel=true;
                return;
            }
        }
    }
}

var clsinfo:ClassInfo[] = JSON.parse( fs.readFileSync( 'clsinfo.json', 'utf8'));

var callinfo=[];// 运行结果拷贝过来

/**
 * 全部初始化为删除
 */
function init(){
    clsinfo.forEach((c:ClassInfo)=>{
        c.mems && c.mems.forEach((m:meminfo)=>{
            m.del=true;
        })
    });
}

/**
 * 某个函数被执行了多少次
 * @param fid 
 * @param count 
 */
function setCallNum(fid:number,count:number){
    clsinfo.forEach((c:ClassInfo)=>{
        c.mems && c.mems.forEach((m:meminfo)=>{
            if(m.id==fid){
                m.del=false;
            }
        })
    });
}

init();
callinfo.forEach((v:number,id:number)=>{
    setCallNum(id,v);
});

//输出
//TODO