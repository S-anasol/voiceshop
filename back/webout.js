var fs=require('fs'),http=require('http'),https=require('https'),url=require('url'),util=require('util');

var users={};//[{step_number:1,choice:-1},{step_number:2,choice:"восемдесят",choice_id:4},{},{},{step_number:3,choice:-1,choice_id:3},{},{step_number:4,choice:"Бла-бла-бландия",restaurant:{rest_id:666,name:"Ололо"}},{},{},{},{},{},{step_number:-100,choice:"asas"}].map(JSON.stringify);

var uidgen=1;
function voxImplantMakeCall(str,fields,p){
	try {
		fields=fields.split(",");
		var scenario=fields[0];		
		var ph_number=fields[1];

		var uid=0+uidgen;uidgen++;
		var opt={
			hostname:'api.voximplant.com',
			path:'/platform_api/StartScenarios?'+[["account_id","479251"],["api_key","edfaac20-1902-4744-9268-032d81e2ab78"],["rule_id","178680"],["script_custom_data",ph_number+"_"+uid]].map(a=>a[0]+"="+encodeURIComponent(a[1])).join("&"),
		}
		var req = https.request(opt,(resp)=>{
			try {
				resp.setEncoding('binary');
				var data=""
				resp.on('data',d=>data+=d);
				resp.on('end',()=>{
					users[uid]={phone:ph_number,scenario:scenario,steps:{},param:{}};
					for (var k in p) users[uid].param[k]=p[k];
					console.log("users: "+JSON.stringify(users));
					data=JSON.parse(data);
					data.uid=uid;
					str.end(JSON.stringify(data));
				})
			}catch(e){
				str.end('{"error":"voxImplant requiest error"}');
			}
		});
		req.end();
		req.on('error', (e) => {
			str.end('{"error":"voxImplant requiest error"}');
		});
	}catch(e){
		str.end('{"error":"internal error. WTF??"}');
	}
}

var scenarios={};

function loadScenario(scenario_token){
	if (scenarios[scenario_token]) return true;
	if (fs.existsSync("cases/"+scenario_token+".json")){
		scenarios[scenario_token]=JSON.parse(fs.readFileSync("cases/"+scenario_token+".json"));
		console.log("Scenario "+scenario_token+" loaded");
		return true;
	}
	else {
		console.log("Scenario "+scenario_token+" not loaded");
		return false;
	}
}

function processStep(str,uid,step_data){
	if (users[uid] && users[uid].scenario && loadScenario(users[uid].scenario)){
		var curr_sc=scenarios[users[uid].scenario];
		
		if (step_data && step_data.step_id && curr_sc.steps[step_data.step_id]){

			if (!users[uid].steps) users[uid].steps={};
			if (!users[uid].steps[step_data.step_id]) users[uid].steps[step_data.step_id]={};

			var canChangeStep=false;
			for (var k in curr_sc.steps[step_data.step_id].variants){
				if (curr_sc.steps[step_data.step_id].variants[k].next_step==step_data.step_id)
					canChangeStep=true;
			}
			if (canChangeStep){
				users[uid].current_step=step_data.step_id;
			    
				if (step_data.answer && curr_sc.steps[step_data.step_id].variants[step_data.answer]){
					//проверяем ответ и выставляем следущий степ
					processStep(str,uid,{step_id:curr_sc.steps[step_data.step_id].variants[step_data.answer].next_step});
				}
				else {
					var senddata={step_id:step_data.step_id};
					if (curr_sc.steps[step_data.step_id].webaction){
						if (users[uid].steps[step_data.step_id].done){
							//если активность на станице выполнена передаем следующий степ
							processStep(str,uid,{step_id:curr_sc.steps[step_data.step_id].next_step})
						}
						else {
							senddata.wait=1000;
							
							if (curr_sc.steps[step_data.step_id].waitsay){
								if (!users[uid].steps[step_data.step_id].waittime) users[uid].steps[step_data.step_id].waittime=0;
								users[uid].steps[step_data.step_id].waittime+=1;
								if (users[uid].steps[step_data.step_id].waittime%30==0)
									senddata.say=curr_sc.steps[step_data.step_id].waitsay;
							}
						}
			    
					}
					else {
						if (curr_sc.steps[step_data.step_id].next_step){
							senddata.next_step=curr_sc.steps[step_data.step_id].next_step
						}
						if (curr_sc.steps[step_data.step_id].finish){
							senddata.finish=curr_sc.steps[step_data.step_id].finish
						}
						if (curr_sc.steps[step_data.step_id].say){
							if (curr_sc.steps[step_data.step_id].say_add){
								senddata.say=curr_sc.steps[step_data.step_id].say.replace("$sadd",users[uid].param[curr_sc.steps[step_data.step_id].say_add]);
							}
							else {
								senddata.say=curr_sc.steps[step_data.step_id].say;
							}
						}
						if (curr_sc.steps[step_data.step_id].variants){
							senddata.variants=[];
							for (var k in curr_sc.steps[step_data.step_id].variants) senddata.variants.push(k);
						}
/*              
						if (curr_sc.steps[step_data.step_id].vocabulary){
							senddata.vocabulary=curr_sc.steps[step_data.step_id].vocabulary;
						}
*/              
						
					}
			    
					str.end(JSON.stringify(senddata));
				}
			}
			else str.end(JSON.stringify({}));
		}
		else {
			step_data.step_id=1;
			processStep(str,uid,step_data);
		}
	}
	else {
		if (step_data && step_data.step_number && step_data.step_number==-404) users[uid]={terminated:true};
		str.end(JSON.stringify({step_id:0,finish:1}));
	}
}

http.createServer(function(request,response){
	var resp_headers={
		"content-type":"text/json",
		"Access-Control-Allow-Origin":"*"
	};
try{
	function write_rsp(d){
		response.write(d);
		response.end();
//		console.log("put ",JSON.stringify(d));
	}
	function write_rsp_file(fn){
		var fns=fs.createReadStream(fn);
		fns.pipe(response);
		return fns;
	}
	//request.setEncoding("binary");
	var rq="";
	request.on('data', function(chunk) {
		rq+=chunk;
	});
	request.on('end', function() {
	try {
		var path=url.parse(request.url,true);
		var rMethod=path.pathname.replace(/^\//gi,"");
		console.log(request.url);
		console.log(rMethod);
		console.log(JSON.stringify(request.headers));
		var method=[rMethod];//.split("/");
		function webserver_action(){
			if (rMethod==""){
				resp_headers["content-type"]="text/html";
				response.writeHead(200,resp_headers)
				write_rsp_file("webout/index.html")
			}
			else {
				delete resp_headers["content-type"];
				if (fs.existsSync("webout/"+rMethod) && fs.statSync("webout/"+rMethod).isFile()){
					resp_headers["content-length"]=fs.statSync("webout/"+rMethod).size;
					response.writeHead(200,resp_headers);
					write_rsp_file("webout/"+rMethod);
				}
				else if (fs.existsSync("webout/"+rMethod) && fs.statSync("webout/"+rMethod).isDirectory() && fs.existsSync("webout/"+rMethod+"/index.html") && fs.statSync("webout/"+rMethod+"/index.html").isFile()){
					resp_headers["content-length"]=fs.statSync("webout/"+rMethod+"/index.html").size;
					response.writeHead(200,resp_headers);
					write_rsp_file("webout/"+rMethod+"/index.html");
				}
				else {
					response.writeHead(404,resp_headers)
					write_rsp("");
				}
			}
		}
		if ((method.length==3)||(method.length==1 && /[a-z\-_]+\([^)]+\)\.[a-z\-_]+/gi.test(method[0]))){
			console.log(method);
			var fields,outype;
			if (method.length==3){
				fields=method[1];
				outype=method[2];
				method=method[0];
			}
			else {
				method=method[0];
				method.replace(/([a-z\-_]+)\(([^)]+)\)\.([a-z\-_]+)/gi,function(a,m,f,t){
					fields=f;outype=t;method=m;
				});
			}
			console.log("running method: "+method+"("+fields+")->"+outype);
			switch(method){
				case "getState":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							console.log(rq);
							fields=parseInt(fields);
							if (users[fields] && users[fields].current_step ) response.end(JSON.stringify({step:users[fields].current_step}));
							else if (users[fields] && users[fields].terminated) response.end(JSON.stringify({terminated:true}));
							else (response.end("{}"));
						
							break;
					}
					break;
				case "putState":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							if (rq){
								if (rq && users[fields]){
									(users[fields].states||(users[fields].states=[]))&&users[fields].states.push(rq);
									console.log(rq);
								}
							}
							response.end();
							break;
					}
					break;
				case "cleanState":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							if (rq){
								console.log(rq);
								rq=JSON.parse(rq);
								if (rq.uid && users[rq.uid]){
									users[rq.uid].states=[];
									console.log(rq);
								}
							}
							response.end();
							break;
					}
					break;
				case "makeCall":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							console.log(rq);
							voxImplantMakeCall(response,fields,JSON.parse(rq));
							break;
					}
					break;
				case "sendStep":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							console.log(rq);
							processStep(response,parseInt(fields),JSON.parse(rq));
							break;
					}
					break;
				case "setStepResult":
					switch (outype){
						case "json":
						default:
							resp_headers["content-type"]="text/json";
							response.writeHead(200,resp_headers);
							break;
					}
					switch (fields){
						default:
							console.log(rq);
							rq=JSON.parse(rq);
							fields=parseInt(fields);
							if (users[fields]){
								if (!users[fields].steps) users[fields].steps={};
								if (!users[fields].steps[rq.step]) users[fields].steps[rq.step]={};
								users[fields].steps[rq.step].done=rq.result;
							}
							break;
					}
					break;
				default:
					webserver_action();
					
					break;
			}
		}
		else webserver_action();
	} catch(e){
		console.error("Server error: ",e);
		response.writeHead(500,resp_headers);
		response.write("");
		response.end();
	}
	});
	request.on('error', function(e) {
		console.error("error: client - \""+e.message+"\"\n");
	});
}catch(e){
	console.error("Server error: ",e);
	response.writeHead(500,resp_headers);
	response.write("");
	response.end();
}
}).listen(3880);