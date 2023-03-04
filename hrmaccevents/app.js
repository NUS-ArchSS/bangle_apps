function saveCSV(filename, csvData) {
  let a = document.createElement("a"),
    file = new Blob([csvData], { type: "Comma-separated value file" });
  let url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}

function createCode() {
  //modes: 1 BT, 2 File
  return (
    "var method=" +
    (document.getElementById("chkLocal").checked ? 2 : 1) +
    ";\n" +
    String.raw`
  var accData=[];
  var maxSize=0;
  var filename="log.csv";

  var gotHRMraw = false;
  var gotBTHRM = false;
  var gotHRM = false;
  var gotAcc = false;
  
  var events = -1;
  var hrmRaw,hrmPulse,bthrmPulse

  function gotAll(){
    return gotBTHRM && gotHRM && gotHRMraw && gotAcc;
  }

  let bthrmSettings = (require("Storage").readJSON("bthrm.json",1) || {});

  Bangle.setHRMPower(1);
  
  if (bthrmSettings.replace) Bangle.origSetHRMPower(1);
  
  if (Bangle.setBTHRMPower){
    Bangle.setBTHRMPower(1);
  } else {
    gotBTHRM = true;
  }

  var write=null;

  if (method == 2){
    var f = require('Storage').open(filename,"w");
    f.erase();
    f = require('Storage').open(filename,"a");
    write = function(str){f.write(str);events++;};
  } else if (method == 1){
    write = function(str){Bluetooth.print("DATA: " + str);events++;};
  }

  write("Time,Acc_x,Acc_y,Acc_z,HRM_b,HRM_c,HRM_r,HRM_f,PPG_r,PPG_o,BTHRM\n");


  function writeAcc(e){
    gotAcc = true;
    acc = e;
    e.date=Date.now();
    accData.push(e);
    accData.splice(0, accData.length - maxSize);
  }

  function writeAccDirect(e){
    gotAcc = true;
    acc = e;
    if (!gotAll()) return;
    write(Date.now()+","+e.x+","+e.y+","+e.z+",,,,,,,,\n");
  }

  function writeBTHRM(e){
    gotBTHRM = true;
    bthrmPulse = e.bpm;
    if (!gotAll()) return;
    write(Date.now()+",,,,,,,,,,"+e.bpm+"\n");
  }

  function writeHRM(e){
    gotHRM = true;
    hrmPulse = e.bpm;
    if (!gotAll()) return;
    while(accData.length > 0){
      var c = accData.shift();
      if (c) write(c.date+","+c.x+","+c.y+","+c.z+",,,,,,,,\n");
    }
    write(Date.now()+",,,,"+e.bpm+","+e.confidence+",,,,\n");
  }

  function writeHRMraw(e){
    gotHRMraw = true;
    hrmRaw = e.raw;
    if (!gotAll()) return;
    write(Date.now()+",,,,,,"+e.raw+","+e.filt+","+e.vcPPG+","+e.vcPPGoffs+",\n");
  }

  if(maxSize){
    Bangle.on("accel", writeAcc);
  } else {
    Bangle.on("accel", writeAccDirect);
  }
  Bangle.on("HRM-raw", writeHRMraw);
  if (bthrmSettings.replace){
    Bangle.origOn("HRM", writeHRM);
  } else {
    Bangle.on("HRM", writeHRM);
  }
  Bangle.on("BTHRM", writeBTHRM);

  g.clear();

  function drawStatusText(name, y){
    g.setFont12x20();
    g.setColor(g.theme.fg);
    g.drawString(name, 24, y * 22 + 2);
  }

  function drawStatus(isOk, y, value){
    g.setFont12x20();
    if (isOk) g.setColor(0,1,0); else g.setColor(1,0,0);
    g.fillRect(0,y * 22, 20, y * 22 + 20);
    g.setColor(g.theme.bg);
    let x = 120
    g.fillRect(x,y*22,g.getWidth(),y*22+20);
    g.setColor(g.theme.fg);
    if (value) g.drawString(value, x, y * 22 + 2);
  }

  function updateStatus(){
    let h = 1;
    drawStatus(gotAcc, h++);
    drawStatus(gotBTHRM, h++, bthrmPulse); bthrmPulse = null;
    drawStatus(gotHRM, h++, hrmPulse); hrmPulse = null;
    drawStatus(gotHRMraw, h++, hrmRaw); hrmRaw = null;
    drawStatus(events>0, h++, Math.max(events,0));
    if (method == 2){
      let free = require('Storage').getFree();
      drawStatus(free>0.25*process.env.STORAGE, h++, Math.floor(free/1024) + "K");
    }
  }
  
  var intervalId = -1;

  g.setFont12x20();
  g.setColor(g.theme.fg);
  g.drawString("Target " + (method==2?"log.csv":"Bluetooth"), 0, 2);

  let h = 1;
  drawStatusText("Acc", h++);
  drawStatusText("BTHRM", h++);
  drawStatusText("HRM", h++);
  drawStatusText("HRM_r", h++);
  drawStatusText("Events", h++);
  if (method == 2) drawStatusText("Storage", h++);
  updateStatus();
  
  intervalId = setInterval(()=>{
    updateStatus();
  }, 1000);

  if (Bangle.setBTHRMPower){
    intervalId = setInterval(()=>{
      if (!Bangle.isBTHRMOn()) Bangle.setBTHRMPower(1);
    }, 5000);
  }
  `
  );
}

var connection;
var lineCount = -1;

function stop() {
  connection.reconnect((c) => {
    c.write("load();\n");
    c.close();
    connection = undefined;
  });
}

function updateButtons() {
  document.getElementById("btnSave").disabled =
    document.getElementById("chkLocal").checked;
  document.getElementById("btnDownload").disabled =
    !document.getElementById("chkLocal").checked;
  document.getElementById("btnReset").disabled =
    document.getElementById("chkLocal").checked;
  document.getElementById("btnStop").disabled =
    document.getElementById("chkLocal").checked;
}

updateButtons();

document.getElementById("chkLocal").addEventListener("click", function () {
  reset();
  updateButtons();
});

window.addEventListener(
  "message",
  function (event) {
    let msg = event.data;
    if (msg.type == "readstoragefilersp") {
      saveCSV("log.csv", msg.data);
    }
  },
  false
);

document.getElementById("btnDownload").addEventListener("click", function () {
  if (connection) {
    stop();
  }
  console.log("Loading data from BangleJs...");
  try {
    window.postMessage({ type: "readstoragefile", data: "log.csv", id: 0 });
  } catch (ex) {
    console.log("(Warning) Could not load apikey from BangleJs.");
    console.log(ex);
  }
});

document.getElementById("btnSave").addEventListener("click", function () {
  saveCSV("log.csv", localStorage.getItem("data"));
});

function reset() {
  document.getElementById("result").innerText = "";
}

document.getElementById("btnReset").addEventListener("click", function () {
  if (connection) {
    stop();
  }
  lineCount = -1;
  localStorage.removeItem("data");
  reset();
});

document.getElementById("btnStop").addEventListener("click", function () {
  if (connection) {
    stop();
  }
});

function connect(connectionHandler) {
  Puck.connect(function (c) {
    if (!c) {
      console.log("Couldn't connect!\n");
      return;
    }
    connection = c;
    connectionHandler(c);
  });
}

document.getElementById("btnConnect").addEventListener("click", function () {
  localStorage.setItem("data", "");
  lineCount = -1;
  if (connection) {
    stop();
    document.getElementById("result").innerText = "0";
  }
  connect(function (connection) {
    var buf = "";
    connection.on("data", function (d) {
      buf += d;
      var l = buf.split("\n");
      buf = l.pop();
      l.forEach(onLine);
    });
    connection.write("reset();\n", function () {
      setTimeout(function () {
        connection.write("\x03\x10if(1){" + createCode() + "}\n", function () {
          console.log("Ready...");
        });
      }, 1500);
    });
  });
});

function onLine(line) {
  console.log("RECEIVED:" + line);
  if (line.startsWith("DATA:")) {
    localStorage.setItem(
      "data",
      localStorage.getItem("data") + line.substr(5) + "\n"
    );
    lineCount++;
    document.getElementById("result").innerText =
      "Captured events: " + lineCount;
  }
}
