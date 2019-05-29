"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
class meminfo {
    constructor(n, p, e) {
        this.del = false;
        this.name = n;
        this.pos = p;
        this.end = e;
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
                                cls.mems.push(new meminfo(bexpinfo.mem, bexpinfo.pos, bexpinfo.end));
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
            ret = { obj: '', mem: '', pos: 0, end: 0 };
            let pa = ex2.left;
            let obj = getIdName(pa.expression); // 对象名
            let mem = getIdName(pa.name); // 对象的属性名
            ret.obj = obj;
            ret.mem = mem;
            ret.pos = exp.pos;
            ret.end = exp.end;
        }
    }
    //ex2.right;
    return ret;
}
function cutjs(infile, outfile) {
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
    console.log(JSON.stringify(layaclass));
    // layaclass 已经有值了
    // 设置删除标志
    configobj.forEach((e) => {
        let cls = getPackClass(e.clsname);
        if (e.alldel) {
            // 全部删除
            cls.alldel = true;
            return;
        }
        // 删除函数
        e.delfun.forEach((fname) => {
            cls.delfunc(fname);
        });
    });
    // 遍历节点，如果是删除的，就删除对应的代码
    let outstr = '';
    let curp = 0;
    layaclass.forEach((v) => {
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
    });
    // 最后剩余的
    outstr += code.substr(curp);
    fs.writeFileSync(path.resolve(p, 'ooo.js'), outstr);
}
exports.cutjs = cutjs;
//cutjs('./jssample.js',null);