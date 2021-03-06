"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
class meminfo {
    constructor(n, p, e, bp) {
        this.id = 0;
        this.del = false;
        this.name = n;
        this.pos = p;
        this.end = e;
        this.bodystart = bp;
    }
}
class ClassInfo {
    //staticMems:meminfo[];
    constructor(name, p, e) {
        this.alldel = false;
        this.hasdel = false; // 有任何删除的都为true，便于快速排除
        this.name = name;
        this.pos = p;
        this.end = e;
    }
    delfunc(f) {
        if (!this.mems)
            return;
        for (let i = 0; i < this.mems.length; i++) {
            let sm = this.mems[i];
            if (sm.name == f) {
                sm.del = true;
                this.hasdel = true;
                return;
            }
        }
    }
}
var layaclass = [];
function getPackClass(packclass) {
    for (let i = 0; i < layaclass.length; i++) {
        if (layaclass[i].packageclass == packclass) {
            return layaclass[i];
        }
    }
    return null;
}
/**
 * 给节点加上名字，便于调试
 * @param node
 */
function addName(node) {
    node._kindname = ts.SyntaxKind[node.kind];
    ts.forEachChild(node, addName);
}
let indent = 0;
/**
 * 递归打印节点
 * @param node
 */
function print(node) {
    console.log(new Array(indent + 1).join(' ') + ts.SyntaxKind[node.kind], node.pos, node.end);
    if (node.kind == ts.SyntaxKind.Identifier) {
        console.log('--', node.text);
    }
    indent++;
    ts.forEachChild(node, print);
    indent--;
}
//print(sc);
function getLayaInfo(root) {
    let src = root;
    // 忽略第一个节点 [0]
    let st1 = src.statements[1];
    // 第二个节点是一个callexp
    if (st1.expression.kind == ts.SyntaxKind.CallExpression) {
        let funcexp = st1.expression
            .expression
            .expression;
        let allst = funcexp.body.statements;
        allst.forEach((n, i) => {
            parseClassInfo(n);
        });
    }
    else {
        console.log('error 67');
    }
}
/**
 * 解析类的函数和静态函数
 * var LayaGLQuickRunner=(function(){
 */
function parseClassInfo(clsdef) {
    if (clsdef.kind != ts.SyntaxKind.VariableStatement) {
        // 只能解析 var Texture = ()();
        return;
    }
    var varlist = clsdef.declarationList;
    if (varlist.declarations.length > 0) { // 应该只有一个定义 var Texture=()()
        let vd = varlist.declarations[0];
        let clsname = vd.name.text;
        if (vd.initializer.kind == ts.SyntaxKind.CallExpression) {
            let cls = new ClassInfo(clsname, clsdef.pos, clsdef.end);
            var calliniter = vd.initializer;
            let func = calliniter.expression.expression;
            let funcbody = (func.body || func.expression.body);
            // class 内部定义
            funcbody.statements.forEach((st) => {
                switch (st.kind) {
                    case ts.SyntaxKind.ExpressionStatement:
                        break;
                    case ts.SyntaxKind.ReturnStatement:
                        break;
                }
                if (st.kind == ts.SyntaxKind.ExpressionStatement) {
                    /**
                     * 表达式，例如call，或者成员赋值
                     * __getset(1,Laya,'alertGlobalError',null,function(value){
                     */
                    let s1 = st.expression;
                    if (s1.kind == ts.SyntaxKind.CallExpression) {
                        let callFuncName = getIdName(s1.expression);
                        if (callFuncName == '___getset') {
                            let pars = getCallParams(s1);
                        }
                        else if (callFuncName == '__class') {
                            let pars = getCallParams(s1);
                            if (pars[0] == clsname) {
                                // 完整包名
                                cls.packageclass = pars[1];
                            }
                        }
                    }
                    else if (s1.kind == ts.SyntaxKind.BinaryExpression) {
                        // 定义函数或者静态函数
                        let bexpinfo = getBinExpInfo(s1);
                        if (bexpinfo) {
                            if (bexpinfo.obj == clsname || bexpinfo.obj == '__proto') {
                                // 静态或者原型函数统一处理
                                cls.mems || (cls.mems = []);
                                cls.mems.push(new meminfo(bexpinfo.mem, bexpinfo.pos, bexpinfo.end, bexpinfo.bodystart));
                            }
                        }
                    }
                }
            });
            layaclass.push(cls);
        }
    }
}
/**
 * 获得Identifier节点对应的变量名
 */
function getIdName(node) {
    if (node.kind == ts.SyntaxKind.Identifier) {
        return node.text;
    }
    return null;
}
/**
 * 获得函数调用的所有的参数
 */
function getCallParams(node) {
    if (node.kind != ts.SyntaxKind.CallExpression)
        return null;
    let c = node;
    let parret = new Array(c.arguments.length);
    c.arguments.forEach((n, i) => {
        switch (n.kind) {
            case ts.SyntaxKind.NullKeyword:
                parret[i] = null;
                break;
            case ts.SyntaxKind.FirstLiteralToken: // 
                parret[i] = n.text;
                break;
            case ts.SyntaxKind.StringLiteral:
                parret[i] = n.text;
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
/**
 * 获得二元操作的信息
 * 这里就是用来获得类的函数用的
 */
function getBinExpInfo(exp) {
    if (exp.kind != ts.SyntaxKind.BinaryExpression)
        return null;
    let ex2 = exp;
    var ret = null;
    //如果是等于赋值 = 
    if (ex2.operatorToken.kind == ts.SyntaxKind.FirstAssignment) {
        // 左边是属性操作,右边是函数
        if (ex2.left.kind == ts.SyntaxKind.PropertyAccessExpression &&
            ex2.right.kind == ts.SyntaxKind.FunctionExpression) {
            ret = { obj: '', mem: '', pos: 0, end: 0, bodystart: 0 };
            let pa = ex2.left;
            let obj = getIdName(pa.expression); // 对象名
            let mem = getIdName(pa.name); // 对象的属性名
            ret.obj = obj;
            ret.mem = mem;
            ret.pos = exp.pos;
            ret.end = exp.end;
            let func = ex2.right;
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
function cutjs(infile, outfile, insert) {
    layaclass = [];
    let p = path.parse(infile).dir; // 输入文件所在路径
    let cfgfile = path.resolve(p, 'layajs.config.json');
    var config = fs.readFileSync(cfgfile, 'utf8');
    if (!config) {
        fs.writeFileSync(cfgfile, `
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
    var configobj = JSON.parse(config);
    if (configobj.length < 1) {
        throw 'config file error!';
    }
    var code = "(function(){})()";
    //code = fs.readFileSync('./jssample.js','utf8');
    //code = fs.readFileSync('./layame.js','utf8');
    code = fs.readFileSync(infile, 'utf8');
    const sc = ts.createSourceFile(infile, code, ts.ScriptTarget.Latest, true);
    addName(sc); // 为了调试方便，给每个节点加上名字
    getLayaInfo(sc);
    //console.log(JSON.stringify(layaclass))    ;
    // layaclass 已经有值了
    // 设置删除标志
    configobj.forEach((e) => {
        let cls = getPackClass(e.clsname);
        if (!cls) {
            console.log('WARN: no this class :', e.clsname);
            return;
        }
        if (e.alldel) {
            // 全部删除
            cls.alldel = true;
            return;
        }
        // 删除函数
        e.delfun && e.delfun.forEach((fname) => {
            cls.delfunc(fname);
        });
    });
    // 遍历节点，如果是删除的，就删除对应的代码
    let outstr = '';
    // 要插入的统计对象
    let statObj = {};
    if (insert) {
        // 如果是插入模式，先加上统计对象
        // 先做一个数组，做id与对象的转换，这样后面只要访问id就行
        let id = 0;
        layaclass.forEach((v) => {
            v.mems && v.mems.forEach((m) => {
                m.id = id++;
            });
        });
        outstr += 'var _gCodeCov=window._gCodeCov=new Array(' + id + ');\n_gCodeCov.fill(0);\n';
        // 输出统计脚本
        fs.writeFileSync(path.resolve(p, 'clsinfo.json'), JSON.stringify(layaclass));
    }
    let curp = 0;
    layaclass.forEach((v) => {
        if (insert) {
            // 如果是插入模式
            v.mems && v.mems.forEach((m) => {
                outstr += code.substring(curp, m.bodystart);
                outstr += `{_gCodeCov[${m.id}]++;`;
                curp = m.bodystart + 1;
            });
        }
        else {
            // 如果是删除模式
            if (v.alldel) {
                // 整个类都删除了
                outstr += code.substring(curp, v.pos);
                // TODO 要不要插入一个空类
                curp = v.end;
                return;
            }
            if (v.hasdel) {
                // 检查删除的函数
                v.mems.forEach((m) => {
                    if (m.del) {
                        outstr += code.substring(curp, m.pos);
                        curp = m.end;
                    }
                });
            }
        }
    });
    // 最后剩余的
    outstr += code.substr(curp);
    fs.writeFileSync(path.resolve(p, 'ooo.js'), outstr);
}
exports.cutjs = cutjs;
//cutjs('./Main.max.js',null,true);
// 裁剪的方法
/**
 * 1. 修改index.js 中的脚本参数，执行，会得到clsinfo.json文件,并且修改输入文件得到ooo.js
 * 2. 执行这个脚本，从window中拷贝 _gCodeCov 数组，复制到 callinfo.json中
 * 3. 执行 getConvInfo.js 脚本，得到一个 layajs.config.json.o 改名去掉o
 * 4. 得到的这个json可以用来裁剪。如果有什么错误，就手动删掉
 *
 */
