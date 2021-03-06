//index.js
//获取应用实例
const app = getApp();

const worker = wx.createWorker('workers/ministdweb.js');

var finishGifPath;
var tipId = 0;

var imageSize = 80;
var prompt;
var textColor = 'white';

var textColors = ['white', 'black', 'red', 'yellow', 'green', 'blue'];

worker.onMessage(function (msg) {
  console.log("主线程收到消息:", msg);
});

var do_preview = false;
var text = "";
var bindText = "";

var canvasContext;
var cameraContext;
var photos = [];

Page({
  showInputText: function(){
    this.setData({ isInputTextHidden: false });
  },
  bindText: function(e){
    bindText = e.detail.value;
  },
  setText: function(){
    text = bindText;
    console.log("文本:", text);
    this.setData({ isInputTextHidden: true});
    this.clearImage();
  },
  onShareAppMessage: function (res) {
    return {
      title: '大头贴动画制作',
      path: '/page/index',
      imageUrl: "/static/basicprofile.png"
    }
  },
  showLoading: function(title){
    //console.log("showLoading title=", title);
    wx.showLoading({
      title: title,
      mask: false,
    });
  },
  showError: function(msg){
    wx.showModal({
      title: '错误',
      content: msg,
    });
  },
  data: {
    redTipHidden: false,
    isInputTextHidden: true,
    cam_position: '前置',
    btnDisabled: false,
    image_count: 0,
    fps: '3帧',
    fps_id: 2,
    fpsArray: ['1帧/秒', '2帧/秒', '3帧/秒', '4帧/秒', '5帧/秒', '6帧/秒', '7帧/秒', '8帧/秒', '9帧/秒', '10帧/秒', '11帧/秒', '12帧/秒'],
    imgSize: '80px',
    imgSizeId: 1,
    imgSizeArray: ["图宽50px", "图宽80px", "图宽100px", "图宽150px", "图宽200px", "图宽250px", "图宽300px", "图宽350px"],
    textColorId: 0,
    textColor: '白色',
    textColorArray: ['白色', '黑色', '红色', '黄色', '绿色', '蓝色'],
    photos: [],
    tool_tip: '点击拍照按钮添加照片'
  },
  createGif1: function(){
    //如果已经生成过gif，直接预览
    if(finishGifPath){
        wx.previewImage({
          urls: [finishGifPath]
        });
      return;
    }
    do_preview = true;
    this.createGif();
  },
  createGif: function(){
    var page = this;
    let count = photos.length;
    if(count <= 1){
      var msg = "至少拍摄两张照片";
      if (count == 0) {
        msg = "请先拍摄照片";
      }
      wx.showToast({icon:'none', title: msg, });
    }else{
      //生成gif
      var makeCount = -1;
      page.showLoading("GIF制作中...");

      worker.onMessage(function (msg) {
        if(msg.what == "progress"){
          page.showLoading("GIF制作中(" + msg.arg0 + "/" + msg.arg1 + ")");
          return;
        }
        console.log("GIF制作完成:", msg);
        const fileData = new Uint8Array(msg.obj);
        //保存制作完成的gif
        let fsm = wx.getFileSystemManager();
        page.showLoading("保存临时文件...");
        let filePath = `${wx.env.USER_DATA_PATH}/` + 'create' + Date.now() + '.gif';
        try {
          let res = fsm.writeFile({
            filePath: filePath, data: fileData.buffer,
            success: function (res) {
              finishGifPath = filePath;
              if (do_preview) {
                wx.previewImage({
                  urls: [filePath]
                });
                do_preview = false;
              } else {
                wx.showModal({
                  title: 'GIF动画制作完成',
                  content: "点击“预览”查看动图\r\n预览页面长按可保存或分享图片",
                  confirmText: "预览",
                  cancelText: "返回",
                  success: function (res) {
                    if (res.confirm) {
                      wx.previewImage({
                        urls: [filePath]
                      });
                    }
                  }
                });
              }
            },
            fail: function (res) {
              page.showError('临时文件保存失败!' + JSON.stringify(res));
            },
            complete: function (res) {
              wx.hideLoading();
            }
          });
        } catch (e) {
          wx.hideLoading();
          page.showError('图片读取失败!' + JSON.stringify(e));
        }
      });
      worker.postMessage({
        what: "create",
        data: new ArrayBuffer(0),
        width: imageSize,
        height: imageSize,
        fps: parseInt(page.data.fps.replace('帧', ''))
      });
    }
  },
  clearImage: function(){
    var page = this;
    page.showLoading("清除图片");
    worker.onMessage(function (msg) {
      console.log("图片已清除:", msg);
      photos.length = 0;
      page.setData({ photos: photos });
      wx.hideLoading();
    });
    worker.postMessage({
      what: "clear",
      data: new ArrayBuffer(0),
      width: 0,
      height: 0,
      fps: 0
    });
  },
  addPhotosToList:function(path, cb){
    var page = this;
    page.showLoading('添加图片...');
    //添加一张照片
    wx.getImageInfo({
      src: path,
      success(res) {
        let width = imageSize;
        let height = imageSize / res.width * res.height;
        let top = (imageSize - height) / 2;
        canvasContext.drawImage(path, 0, top, width, height);
        canvasContext.setFillStyle(textColor);
        //canvasContext.setStrokeStyle(textColor);
        canvasContext.setFontSize(imageSize/8);
        canvasContext.fillText(text, 10, imageSize-(imageSize/7), imageSize);
        //canvasContext.strokeText("我很惊讶", 10, imageSize - (imageSize / 8), imageSize);
        canvasContext.draw(false, function () {
          //提取图片
          wx.canvasGetImageData({
            canvasId: 'canvas',
            x: 0,
            y: 0,
            width: imageSize,
            height: imageSize,
            success(res) {
              console.log("canvasGetImageData", res);
              worker.onMessage(function (msg) {
                //console.log("图片添加成功:", msg);
                photos.push({ path: path });
                page.setData({ photos: photos });
                wx.hideLoading();
                cb();
              });
              worker.postMessage({
                what: "add",
                data: res.data.buffer,
                width: 0,
                height: 0,
                fps: 0
              });
            },
            fail: function (err) {
              cb();
              wx.hideLoading();
              page.showError('添加失败!' + JSON.stringify(res));
            }
          });
        });
      }
    });
  },
  //从相册选择照片
  chooseImage: function(){
    var page = this;
    wx.chooseImage({
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: res => {
        if (res.tempFilePaths && res.tempFilePaths.length>0){
          var idx = 0;
          var cb1;
          var cb = function(){
              idx += 1;
              if (idx < res.tempFilePaths.length) {
                page.addPhotosToList(res.tempFilePaths[idx], cb1);
              } else {
                //console.log(new Date(), '选择的图片:', page.data.photos);
              }
          };
          cb1 = cb;
          page.addPhotosToList(res.tempFilePaths[idx], cb1);
        }
      }
    });
  },
  //切换前后摄像头
  changeCamera: function(){
    let curPos = this.data.cam_position;
    if(curPos=='front'){
      this.setData({ cam_position: 'back'});
    }else{
      this.setData({ cam_position: 'front' });
    }
  },
  takePhoto: function(){
    var page = this;
    //禁止拍照按钮
    page.setData({ btnDisabled: true});
    cameraContext.takePhoto({
      quality: 'normal',
      success: (res) => {
        //console.log(new Date(), "拍照结果:", res.tempImagePath);
        page.addPhotosToList(res.tempImagePath, function(){
          page.setData({ btnDisabled: false });
        });
        var strs = [
          '微微移动相机、加快连拍速度、调高帧率，使动画更流畅',
          '调低图片像素(例如50px)，加快制作速度',
          '如果无法拍照，请退出小程序并重新进入'];
        var change = Math.random()<0.3;
        if (change){
          let rand = Math.random();
          if (rand < 0.4) {
            tipId = 0;
          } else if (rand > 0.4 && rand < 0.8) {
            tipId = 1;
          } else {
            tipId = 2;
          }
        }
        page.setData({ tool_tip: strs[tipId]});
      },
      fail: function (res) {
        page.setData({ btnDisabled: false });
        page.showError('拍照失败!' + JSON.stringify(res));
      }
    });
  },
  closeRedTip: function(e){
    this.setData({ redTipHidden: true });
  },
  //事件处理函数
  bindFpsChange: function(res) {
    this.setData({ fps_id: res.detail.value });
    this.setData({fps: this.data.fpsArray[res.detail.value].replace('/秒', '')});
  },
  bindImgSizeChange: function(res){
    this.clearImage();
    imageSize = parseInt(this.data.imgSizeArray[res.detail.value].replace('图宽', '').replace('px', ''));
    console.log("imageSize=", imageSize);
    this.setData({ imgSizeId: res.detail.value });
    this.setData({ imgSize: imageSize+'px' });
  },
  bindTextColorChange: function(res){
    this.clearImage();
    textColor = textColors[res.detail.value];
    console.log("textColor=", textColor);
    this.setData({ textColor: this.data.textColorArray[res.detail.value], textColorId: res.detail.value });
  },
  onShow: function(){
    this.setData({ btnDisabled: false });
  },
  onLoad: function () {
    canvasContext = wx.createCanvasContext('canvas');
    cameraContext = wx.createCameraContext();
  }
})
