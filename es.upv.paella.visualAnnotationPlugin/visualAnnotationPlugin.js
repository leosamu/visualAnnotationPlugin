/**
 * Created by leosamu on 24/9/15.
 */
paella.dataDelegates.VisualAnnotationsDataDelegate = Class.create(paella.DataDelegate,{
	read: function(context, params, onSuccess) {	 
	   $.getJSON(params.url + params.id + "/annotations",function(data){
		              if (typeof(onSuccess)=='function') { onSuccess(data, true); }
       });
   },
   
   write: function(context, params, data, onSuccess) {
		$.getJSON('/rest/video/' + paella.initDelegate.getId() + "/annotations",function(previous){
						        
			previous.forEach(function(preannotation)
			{
				$.ajax({
				    url: '/rest/video/' + preannotation.video + '/annotation/' + preannotation['_id'],
				    type: 'DELETE',
				    success: function(result) {
				        // Do something with the result
				        console.log(result);
				    }
				});
			});
							              
		})
        .then(
	        data.forEach(function(annotation)
			{
				var body = {};
				body['annotation']=annotation;
				$.post( '/rest/video/'+ annotation.video +'/annotation/' + annotation.id, body);	
			}));
		onSuccess(data, true);
	}
   
});


Class ("paella.plugins.visualAnnotationPlugin", paella.EventDrivenPlugin,{
	//_url:this.config.url,
	_annotations:[], //will store the annotations
	_ready:false,
    _paused:null,
    _rootElement:null,
    _prevProfile:null,//we store the profile we had before opening the annotation
	checkEnabled:function(onSuccess) {
		onSuccess(true);
	},
	
	getAnnotations:function() {
		var This = this;
		if (this._ready) {
			return paella_DeferredResolved(This._annotations);
		}
		else {
			var defer = $.Deferred();
			var waitFunc = function() {
				if (This._ready) {
					defer.resolve(This._annotations);
				}
				setTimeout(waitFunc,200);	
			};
			waitFunc();
			return defer;
		}
	},
	
	getName:function() {
		return "es.upv.paella.visualAnnotationPlugin";
	},

	getEvents:function() {
		return[
			paella.events.timeUpdate
		];
    },

    setup:function(){
    	var self = this;   
		//TODO- maybe i need to set the style here 
        paella.data.read('visualAnnotations',{id:paella.initDelegate.getId(),url:self.config.url},function(data,status) {
	        self._ready = true;
            self._annotations = data;
        });
        self._prevProfile=null;
    },

    onEvent:function(event, params){
    	var self = this;
    	switch(event){
    		case paella.events.timeUpdate:
                this.drawAnnotation(event,params);
                break;
            case paella.events.seekToTime:
                this.drawAnnotation(event,params);
            	break;
    	}
    },
    
    addAnnotation: function(annotation){
	    var self = this;
	    self._annotations.push(annotation);
    },
    
    removeAnnotation: function(annotationId){
	    var self = this;
	    index = -1;
	    for (var key in self._annotations) 
	    	if (self._annotations[key]._id==annotationId) 
	    		index =key;
	    self._annotations.splice(index,1);
	    self.closeAnnotation(annotationId); 
    },
    
    updateAnnotation: function(annotation){
	    var self = this;
	    index = -1;
	    for (var key in self._annotations) if (self._annotations[key]._id==annotation._id) index =key;
	    self._annotations.splice(index,1);
	    self._annotations.push(annotation);
	    self.closeAnnotation(annotation._id); 
	    paella.player.videoContainer.seekToTime(annotation.time + annotation.duration/2);
    },

    drawAnnotation:function(event,params){
    	var self = this;
    	var p = {};
    	//var annotation = {};
    	p.closeButton=true;
    	p.onClose = function(){
    		paella.events.trigger(paella.events.play);
    	};
    	self._annotations.some(function(element, index, array){
            currentTime = Math.round(params.currentTime);
			var annotation = JSON.parse(element.content);
			//if we are on time and the annotation does not exist
    		if(currentTime >= element.time && currentTime <= element.time+element.duration && $("#" + element._id).length==0 && element.video == paella.player.videoIdentifier){
	    		//var annotation = JSON.parse(element.content);
                //create a layer for each type of videoanotation
                var layer = paella.player.videoContainer.overlayContainer.getLayer(element.type);
                var rect = annotation.format;
                //we clear the container before inserting new elements
                //overlayContainer.removeElement(self._rootElement);
                self._rootElement = document.createElement("div");
                self._rootElement.className = element.type + 'textAnnotation';
                self._rootElement.id=element._id;

                var button = document.createElement("div");
                button.className ="annotationClose righttop";
                button.innerHTML = "X";
                button.onclick = function(){
                    $('#' + element._id).css({ display: "none" });
                };

                var el = document.createElement("div");
                el.className = 'innerAnnotation';
                //aqui
                for (var firstKey in annotation.data) break;
                var converter = new Showdown.converter();
                var dataText = annotation.data[navigator.language || navigator.userLanguage]||annotation.data[firstKey];
                var dataHtml = converter.makeHtml(dataText);
                switch(element.type){
					case "Link":
						 el.innerHTML = '<div class="AdtextAnnotationLink" ><img src="./resources/images/popup.png" class="AdtextAnnotationIMG"></div>  <div class="AdtextAnnotationBody"><a href="' + dataText + '">' + dataText + '</a></div></div>';
						break;					
					case "Embed":
						el.innerHTML = '<embed src="' + dataText + '" width="100%" height="443">';
						break;
					case "Text":
						el.innerHTML = dataHtml;
						break;
					default:
						el.innerHTML = dataHtml;
					}
                
                /*if (element.type=="Link") {
                   
                }
                else
                {	                
                    el.innerHTML = dataHtml;
                }*/

                if (annotation.profile!=""){
                    //we need to store and recover the profile
                    if (self._prevProfile == null){
                        self._prevProfile = paella.plugins.viewModePlugin.active_profiles||paella.Profiles.getDefaultProfile();
                    }
                    paella.events.trigger(paella.events.setProfile,{profileName:annotation.profile});
                }
                el.appendChild(button);
                //let create the style
				//patata?
                var sheet = document.createElement('style');
				console.log("style!");
                sheet.innerHTML=annotation.css;
                el.appendChild(sheet);
                
                self._rootElement.appendChild(el);
				
                //overlayContainer.addElement(self._rootElement, rect);
                layer.appendChild(self._rootElement);
	    		return true;
    		}
            //we close annotations when annotation time is gone.
            if ((currentTime < element.time || currentTime > element.time + element.duration) && $("#" + element._id).length!=0){
	            //var annotation = JSON.parse(element.content);
	            
                if (annotation.pauser==true && self._paused!=element._id)
                { 
	              self._paused=element._id;
                  paella.player.pause();
	         	}else
                {
	                var paused = true;
	                paella.player.paused().then(function(p){ paused=p; });
	                if (!paused){
		               self._paused=null;
					   self.closeAnnotation(element._id); 
	                }
	            	
                }
                return true;
            }
    	});

    },

   
    closeAnnotation:function(elementID){
        //if (forced) this._closedIds.push(element._id);
        paella.events.trigger(paella.events.setProfile,{profileName:this._prevProfile});
        this._prevProfile=null;
        $('#'+elementID).remove();
    }
});
paella.plugins.visualAnnotationPlugin = new paella.plugins.visualAnnotationPlugin();