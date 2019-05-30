
import ts = require("typescript");
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



var layaclass:ClassInfo[]=[];
function getPackClass(packclass:string):ClassInfo{
    for(let i=0; i<layaclass.length; i++){
        if( layaclass[i].packageclass==packclass){
            return layaclass[i];
        }
    }
    return null;
}

/**
 * 给节点加上名字，便于调试
 * @param node 
 */
function addName(node:ts.Node){
    (node as any)._kindname=ts.SyntaxKind[node.kind];
    ts.forEachChild(node, addName);
}


let indent = 0;
/**
 * 递归打印节点
 * @param node 
 */
function print(node: ts.Node) {
    console.log(new Array(indent + 1).join(' ') + ts.SyntaxKind[node.kind],
        node.pos,node.end
    );
    if( node.kind == ts.SyntaxKind.Identifier){
        console.log('--', (node as ts.Identifier).text);
    }
    indent++;
    ts.forEachChild(node, print);
    indent--;
}

//print(sc);

function getLayaInfo(root:ts.Node){
    let src = root as ts.SourceFile;
    // 忽略第一个节点 [0]
    let st1 = src.statements[1] as ts.ExpressionStatement;
    // 第二个节点是一个callexp
    if( st1.expression.kind == ts.SyntaxKind.CallExpression){
        let funcexp = ((st1.expression as ts.CallExpression)
                        .expression as ts.ParenthesizedExpression)
                            .expression as ts.FunctionExpression;
        let allst = (funcexp.body as ts.Block).statements;
        allst.forEach( (n:ts.Node,i:number)=>{
            parseClassInfo(n as ts.VariableStatement);
        })
    }else{
        console.log('error 67');
    }
}


/**
 * 解析类的函数和静态函数
 * var LayaGLQuickRunner=(function(){
 */
function parseClassInfo(clsdef:ts.VariableStatement){
    if( (clsdef as ts.Node).kind != ts.SyntaxKind.VariableStatement){
        // 只能解析 var Texture = ()();
        return; 
    }
    var varlist = clsdef.declarationList as ts.VariableDeclarationList;
    if(varlist.declarations.length>0){// 应该只有一个定义 var Texture=()()
        let vd = varlist.declarations[0] as ts.VariableDeclaration;
        let clsname = (vd.name as ts.Identifier).text;
        if( vd.initializer.kind == ts.SyntaxKind.CallExpression){
            let cls = new ClassInfo(clsname, clsdef.pos,clsdef.end);
            var calliniter = vd.initializer as ts.CallExpression;
            let func = (calliniter.expression as ts.ParenthesizedExpression).expression as ts.FunctionExpression;
            let funcbody = (func.body || (func as any).expression.body) as ts.Block;
            // class 内部定义
            funcbody.statements.forEach((st:ts.Node)=>{
                switch( st.kind){
                    case ts.SyntaxKind.ExpressionStatement:
                    break;
                    case ts.SyntaxKind.ReturnStatement:
                    break;
                }
                if(st.kind == ts.SyntaxKind.ExpressionStatement ){
                    /**
                     * 表达式，例如call，或者成员赋值
                     * __getset(1,Laya,'alertGlobalError',null,function(value){
                     */
                    let s1 =(st as ts.ExpressionStatement).expression;
                    if(s1.kind == ts.SyntaxKind.CallExpression){
                        let callFuncName = getIdName((s1 as ts.CallExpression).expression);
                        if( callFuncName == '___getset'){
                            let pars = getCallParams(s1);
                        }
                        else if( callFuncName=='__class'){
                            let pars = getCallParams(s1);
                            if(pars[0]==clsname){
                                // 完整包名
                                cls.packageclass=pars[1];
                            }
                        }
                    }else if( s1.kind == ts.SyntaxKind.BinaryExpression){
                        // 定义函数或者静态函数
                        let bexpinfo = getBinExpInfo(s1);
                        if(bexpinfo){
                            if( bexpinfo.obj == clsname || bexpinfo.obj=='__proto'){
                                // 静态或者原型函数统一处理
                                cls.mems ||(cls.mems=[]);
                                cls.mems.push(new meminfo(bexpinfo.mem,bexpinfo.pos,bexpinfo.end, bexpinfo.bodystart));
                            }
                        }
                    }
                }
            })
            layaclass.push(cls);
        }
    }
}

/**
 * 获得Identifier节点对应的变量名
 */
function getIdName(node:ts.Node){
    if(node.kind==ts.SyntaxKind.Identifier){
        return (node as ts.Identifier).text
    }
    return null;
}

/**
 * 获得函数调用的所有的参数
 */
function getCallParams(node:ts.Node){
    if(node.kind!=ts.SyntaxKind.CallExpression)
        return null;
    let c = node as ts.CallExpression;
    let parret:string[] = new Array(c.arguments.length);
    c.arguments.forEach( (n:ts.Node,i:number) =>{
        switch(n.kind){
            case ts.SyntaxKind.NullKeyword:
                parret[i] = null;
            break;
            case ts.SyntaxKind.FirstLiteralToken: // 
                parret[i] = (n as any).text;
            break;
            case ts.SyntaxKind.StringLiteral:
                parret[i] = (n as any).text;
            break;
            case ts.SyntaxKind.Identifier:
                parret[i] = getIdName(n);
            break;
            case ts.SyntaxKind.FunctionExpression:
                // TODO 
            break;
        }
    });
    return parret;
}


interface binexpret{
    obj:string,mem:string,pos:number,end:number;
    bodystart:number;
}
/**
 * 获得二元操作的信息
 * 这里就是用来获得类的函数用的
 */
function getBinExpInfo(exp:ts.Node,):binexpret{
    if(exp.kind != ts.SyntaxKind.BinaryExpression)
        return null;
    let ex2 = exp as ts.BinaryExpression;
    var ret:binexpret=null;
    //如果是等于赋值 = 
    if(ex2.operatorToken.kind == ts.SyntaxKind.FirstAssignment){
        // 左边是属性操作,右边是函数
        if( ex2.left.kind == ts.SyntaxKind.PropertyAccessExpression &&
            ex2.right.kind == ts.SyntaxKind.FunctionExpression){
            ret={obj:'',mem:'',pos:0,end:0,bodystart:0};
            let pa = ex2.left as ts.PropertyAccessExpression;
            let obj = getIdName(pa.expression); // 对象名
            let mem = getIdName(pa.name);       // 对象的属性名
            ret.obj = obj;
            ret.mem=mem;
            ret.pos = exp.pos;
            ret.end = exp.end;
            let func = ex2.right as ts.FunctionExpression;
            ret.bodystart = func.body.pos;
        }
    }
    //ex2.right;
    return ret;
}


/**
 * 
 * @param infile 
 * @param outfile 
 * @param insert 是否插入统计代码
 */
export function cutjs(infile:string,outfile:string,insert:boolean){
    layaclass=[];
    let p = path.parse(infile).dir;// 输入文件所在路径
    let cfgfile = path.resolve(p,'layajs.config.json');
    var config = fs.readFileSync( cfgfile, 'utf8');
    if(!config){
        fs.writeFileSync(cfgfile,`
[
    {
        "clsname":"laya.webgl.canvas.save.SaveBase",
        "alldel":false,
        "delfun":[
            "isSaveMark"
        ]
    }
]
    `);
        throw 'error! no config file';
    }
    
    var configobj = JSON.parse(config) ;
    if(configobj.length<1){
        throw 'config file error!';
    }
    
    
    var code = "(function(){})()"
    //code = fs.readFileSync('./jssample.js','utf8');
    //code = fs.readFileSync('./layame.js','utf8');
    code = fs.readFileSync(infile,'utf8');
    
    const sc = ts.createSourceFile(infile, code, ts.ScriptTarget.Latest, true);
    addName(sc);// 为了调试方便，给每个节点加上名字

    getLayaInfo(sc);

    //console.log(JSON.stringify(layaclass))    ;
    // layaclass 已经有值了
    // 设置删除标志
    configobj.forEach((e:{clsname:string,alldel:boolean,delfun:string[]}) => {
        let cls = getPackClass(e.clsname);
        if(!cls){
            console.log('WARN: no this class :',e.clsname)
            return;
        }
        if(e.alldel){
            // 全部删除
             cls.alldel=true;
             return;
        }
        // 删除函数
        e.delfun && e.delfun.forEach( (fname:string)=>{
            cls.delfunc(fname);
        })

    });
    // 遍历节点，如果是删除的，就删除对应的代码
    let outstr='';

    // 要插入的统计对象
    let statObj = {};
    if(insert){
        // 如果是插入模式，先加上统计对象
        // 先做一个数组，做id与对象的转换，这样后面只要访问id就行
        let id=0;
        layaclass.forEach((v:ClassInfo)=>{
            v.mems && v.mems.forEach((m:meminfo)=>{
                m.id=id++;
            });
        });
        outstr +='var _gCodeCov=window._gCodeCov=new Array('+id+');\n';
        // 输出统计脚本
        fs.writeFileSync(path.resolve(p,'clsinfo.json'), JSON.stringify(layaclass));
    }
    let curp=0;
    layaclass.forEach((v:ClassInfo)=>{
        if(insert){
            // 如果是插入模式
            v.mems && v.mems.forEach((m:meminfo)=>{
                outstr+=code.substring(curp,m.bodystart);
                outstr+=`{_gCodeCov[${m.id}]++;`;
                curp = m.bodystart+1;
            });
        }else{
            // 如果是删除模式
            if(v.alldel){
                // 整个类都删除了
                outstr += code.substring(curp,v.pos);
                // TODO 要不要插入一个空类
                curp = v.end;
                return;
            }
            if(v.hasdel){
                // 检查删除的函数
                v.mems.forEach((m:meminfo)=>{
                    if(m.del){
                        outstr+=code.substring(curp,m.pos);
                        curp = m.end;
                    }
                });
            }
        }
    });
    // 最后剩余的
    outstr+=code.substr(curp);
    
    fs.writeFileSync(path.resolve(p,'ooo.js'),outstr);
}

cutjs('./jssample.js',null,true);