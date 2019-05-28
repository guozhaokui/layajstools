var Laya=window.Laya=(function(window,document){
    var Laya={
    };
})(window,document);

(function(window,document,Laya){
    var __un=Laya.un,__uns=Laya.uns,__static=Laya.static,__class=Laya.class,__getset=Laya.getset,__newvec=Laya.__newvec;
    
    Laya.interface('laya.ui.IItem');

    var ___Laya=(function(){
        __getset(1,Laya,'alertGlobalError',null,function(value){
        });

        Laya.init=function(width,height,__plugins){
        }

        Laya.stage=null;
        __static(Laya,
            ['conchMarket',function(){return this.conchMarket=window.conch?conchMarket:null;},'PlatformClass',function(){return this.PlatformClass=window.PlatformClass;},'_evcode',function(){return this._evcode="eva"+"l";}
            ]);
        return Laya;
    })();

    var SaveBase=(function(){
        function SaveBase(){}
        __class(SaveBase,'laya.webgl.canvas.save.SaveBase');
        var __proto=SaveBase.prototype;
        Laya.imps(__proto,{'laya.webgl.canvas.save.ISaveData':true});
        __proto.isSaveMark=function(){return false;};
        __proto.restore=function(context){};

        SaveBase._createArray=function(){ };
        SaveBase.POOL=laya.webgl.canvas.save.SaveBase._createArray();
        SaveBase._namemap=SaveBase._init();
        return SaveBase;
    })();

})(window,document,Laya);
