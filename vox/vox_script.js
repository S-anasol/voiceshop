require(Modules.ASR);

var call, phone;

var asr;

var node_id=1;

var talkProcessor = function(){
  
  var callevent;
  var sendData = {};
  
  constructorFn.setCall = function(e){
    callevent = e;
  };
  
  function constructorFn(){};

  constructorFn.askStep = function(){
    var opts = {
    	method: "POST",
      	postData: JSON.stringify(sendData)
    };
    Net.httpRequest("http://www.voicebots.ru/sendStep("+node_id+").json",talkProcessor.makeStep,opts);
  };
  
  constructorFn.init = function(){
    talkProcessor.askStep();
  };
  
  constructorFn.say = function (input){
	callevent.say(input.to_say, Language.RU_RUSSIAN_MALE);
    if (typeof input.callback != 'undefined'){
     	callevent.addEventListener(CallEvents.PlaybackFinished,input.callback);
    }
  };
  
  constructorFn.recognize = function(input){
    asr = VoxEngine.createASR(ASRLanguage.RUSSIAN_RU, input);
			// Handle ASREvents.CaptureStarted (fired when system detects voice input and start collecting data for ASR)
			asr.addEventListener(ASREvents.CaptureStarted, function(e) {
                callevent.stopPlayback();
            });
			// Handle recognition result
			asr.addEventListener(ASREvents.Result, function(asrevent) {
				asr.stop();
				if (asrevent.confidence > 0){
					sendData.answer = asrevent.text;
                  	talkProcessor.askStep();
				} else {
					talkProcessor.makeStep(res);
				}

			});
			// Send call media to ASR instance
			callevent.sendMediaTo(asr);
  };
  
  constructorFn.makeStep = function(res){
    if (typeof res.text != 'undefined'){
     res = JSON.parse(res.text); 
    }
    if (typeof res != 'undefined'){
     sendData.step_id = res.step_id; 
    }
    function afterSay(){
     if (typeof res.wait != 'undefined'){
      		// wait for res.wait
      		setTimeout(talkProcessor.askStep,res.wait);
    	} else {
			if (typeof res.next_step != 'undefined'){
				sendData.step_id = res.next_step;
				// make a request
          		talkProcessor.askStep();
			} else if (typeof res.finish != 'undefined') {
				// TODO: finish the call
            	VoxEngine.terminate();
			} else if (typeof res.variants != 'undefined'){
				talkProcessor.recognize(res.variants);
			}
    	} 
    }
    if (typeof res.say != 'undefined'){
      talkProcessor.say({
        				  to_say:res.say,
        				  callback:afterSay
      					});
    } else { 
      afterSay();
    }
  };
  
  return constructorFn;
}();


// Inbound call
VoxEngine.addEventListener(AppEvents.Started, function (e) {
  //    в сценарий можно передать данные с помощью механизма customData,
  // параметр script_custom_data в HTTP-запросе startScenarios
  var cdata = VoxEngine.customData();
  cdata=cdata.split("_");
  var phone=cdata[0];
  node_id = cdata[1];
  // начало выполнения сценария - звоним на номер
  call = VoxEngine.callPSTN(phone);

  	talkProcessor.setCall(call);
    call.addEventListener(CallEvents.Connected, handleCallConnected);
    call.addEventListener(CallEvents.Disconnected, handleCallDisconnected);
 	call.addEventListener(CallEvents.Failed, handleCallFailed);
});


function handleCallConnected() {
  	talkProcessor.init();
}

function handleCallDisconnected(e) {
  var code = e.code,
  reason = e.reason;
  
  var user_fail = {
                        step_number: -404,
                        choice: e.reason,
                        choice_id: e.code
                    };

  var opts_fail = {
                              method: "POST",
                              postData: JSON.stringify(user_fail),
                  			  params: { encoding: "utf8"}
                   };
 
    Net.httpRequest("http://www.voicebots.ru/sendStep("+node_id+").json", function(e1) {
    
    VoxEngine.terminate();
  }, opts_fail);
}
function handleCallFailed(e) {
  var code = e.code,
  reason = e.reason;
  
  var user_fail = {
                        step_number: -505,
                        choice: e.reason,
                        choice_id: e.code
                    };

  var opts_fail = {
                     method: "POST",
                     postData: JSON.stringify(user_fail),
                  	 params: { encoding: "utf8"}
                   };
  Net.httpRequest("http://www.voicebots.ru/sendState("+node_id+").json", function(e1) {
    // информация по реузльтатам запроса - e1.code, e1.text, e1.data, e1.headers
    VoxEngine.terminate();
  }, opts_fail);
}
