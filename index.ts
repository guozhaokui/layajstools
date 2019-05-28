

import ts = require("typescript");
import fs = require('fs');

var code = "(function(){})()"
code = fs.readFileSync('./jssample.js','utf8');
//code = fs.readFileSync('./layame.js','utf8');

const sc = ts.createSourceFile('layame.js', code, ts.ScriptTarget.Latest, true);

function addName(node:ts.Node){
    (node as any)._kindname=ts.SyntaxKind[node.kind];
    ts.forEachChild(node, addName);
}
addName(sc);// 为了调试方便，给每个节点加上名字

let indent = 0;
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
//parseAst(sc);
//getAllGlobalObject(sc);
getLayaInfo(sc);

function parseAst(node:ts.Node){
    let cs = ts.forEachChild(node,(node:ts.Node)=>{
        console.log(ts.SyntaxKind[node.kind]);
        let n = node;
    });
}

function getAllClass(file:ts.Node){

}

function getAllGlobalObject(file:ts.SourceFile){
    file.statements.forEach((v:ts.Statement)=>{
        if( v.kind == ts.SyntaxKind.VariableStatement){
            var varst = (v as ts.VariableStatement);
            varst.declarationList.declarations.forEach( (vd:ts.VariableDeclaration)=>{
                //console.log(vd.getText(file));//vd.name);
                console.log((vd.name as any).text);
            });
        }
    });
}

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
    // 进入第二个 [1]  ExpressionStatement
    //root.statements[1].expression; //CallExpression
    //  .expression  :ParenthesizedExpression
    //    .expression :FunctionExpression
    //      .body : Block
    //        .statements : NodeObject[1278]   
    /*
                只找这里的 VariableStatement 类型的
                例如 VariableStatement
                是赋值  var __un= ..

                ExpressionStatement 是调用
                    Laya.interface('laya.ui.IItem');

                    .expression : CallExpression

    */
}

/**
 * 解析类的函数和静态函数
 * var LayaGLQuickRunner=(function(){
 */
function parseClassInfo(clsdef:ts.VariableStatement){
    clsdef.pos;
    clsdef.end;
    var varlist = clsdef.declarationList as ts.VariableDeclarationList;
    if(varlist.declarations.length>0){// 应该只有一个定义 var Texture=()()
        let vd = varlist.declarations[0] as ts.VariableDeclaration;
        let clsname = (vd.name as ts.Identifier).text;
        if( vd.initializer.kind == ts.SyntaxKind.CallExpression){
            var calliniter = vd.initializer as ts.CallExpression;
            let func = (calliniter.expression as ts.ParenthesizedExpression).expression as ts.FunctionExpression;
            let funcbody = func.body as ts.Block;
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
                    }else if( s1.kind == ts.SyntaxKind.BinaryExpression){
                        // 定义函数或者静态函数
                        let bexpinfo = getBinExpInfo(s1);
                    }
                }
            })
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
}
/**
 * 获得二元操作的信息
 */
function getBinExpInfo(exp:ts.Node,):binexpret{
    if(exp.kind != ts.SyntaxKind.BinaryExpression)
        return null;
    let ex2 = exp as ts.BinaryExpression;
    var ret:binexpret=null;
    //如果是等于赋值 = 
    if(ex2.operatorToken.kind == ts.SyntaxKind.FirstAssignment){
        ret={obj:'',mem:'',pos:0,end:0};
        // 左边是属性操作,右边是函数
        if( ex2.left.kind == ts.SyntaxKind.PropertyAccessExpression &&
            ex2.right.kind == ts.SyntaxKind.FunctionExpression){
            let pa = ex2.left as ts.PropertyAccessExpression;
            let obj = getIdName(pa.expression); // 对象名
            let mem = getIdName(pa.name);       // 对象的属性名
            ret.obj = obj;
            ret.mem=mem;
            ret.pos = exp.pos;
            ret.end = exp.end;
        }
    }
    //ex2.right;
    return ret;
}