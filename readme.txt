ts node
pos 起点
end 终点
kind 类型
ts.SyntaxKind 类型对应的名字
text 内容

节点并没有child成员，根据不同的节点类型，不同的成员指向子
例如
    interface SourceFile extends Declaration {
        kind: SyntaxKind.SourceFile;
        statements: NodeArray<Statement>;