#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
const cutjs = require( '../index').cutjs;


function help(){
    console.log(`
layajs inputfile    
`);
}

if (process.argv.length < 3) {
    help();
    process.exit(1);
}

var srcpath = path.resolve(process.cwd(), process.argv[2]);
if(!fs.existsSync(srcpath)){
    console.log( '没有找到文件:'+ process.argv[2]);
    process.exit(1);
}

var p = path.parse(srcpath).dir;
var out = path.resolve(p,'ooo.js');

cutjs(srcpath,out);

