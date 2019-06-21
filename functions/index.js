const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.addNotification = functions.database.ref('/notification/{uid}/{nid}/{ntime}').onCreate(event=>{
        const {uid,nid} = event.params;
        const text = event.data.child('text').val();
        const type = event.data.child('type').val();
        const status = ['DÉBUTANTE','FASHIONISTA','BRANCHÉ','INFLUENCEUR','INFLUENCEUR CONFIRMÉ','TOP INFLUENCEUR','ICÔNE','VIP'];
        admin.database().ref('/users/'+uid).child('devicelanguage').once('value',function(data){
            const devicelanguage=data.val();
            let resulttext = text;
            if(devicelanguage==='fr'){
                if(type==='welcome'){
                    resulttext = 'Bienvenue!';
                }else if(type==='start'){
                    resulttext = 'Hello ! Nouveau challenge.';
                }else if(type==='end'){
                    resulttext = 'Voir les résultats du challenge!';
                }else if(type==='maxvote'){
                    resulttext = text+' adore ton look!';
                }else if(type==='follow'){
                    resulttext = text+' commence à te suivre!';
                }else if(type==='level'){
                    resulttext = 'Bravo! Tu as atteint un nouveau status '+status[event.data.child('id').val()];
                }else if(type==='bonus'){
                    resulttext = 'Bravo! Tu as gagné un bonus!';
                }
            }else{
                if(type==='maxvote'){
                    resulttext = text+' love your look!';
                }else if(type==='follow'){
                    resulttext = text+' starts to follow you!';
                }else if(type==='level'){
                    resulttext = 'Bravo! You have reached a new status '+text
                }
            }
            console.log(`notification to ${uid}:${resulttext}`);
            admin.database().ref('/users/'+uid+"/appbadge").child(nid).transaction(function(appbadge){
                return appbadge+1;
            }).then(()=>{
                admin.database().ref('/users/'+uid+"/appbadge").child(nid).once('value',function(appbadge){
                    const payload = {
                        data: {nid},
                        notification: {
                            body: resulttext,
                            // title:'welcome',
                            sound:'default',
                            badge:appbadge.val().toString(),
                        }
                    };
                    console.log(`${uid} badge = ${appbadge.val().toString()}`);
                    admin.messaging().sendToTopic(`/topics/${uid}`,payload)
                    .then(result => console.log(result))
                    .catch(error => console.error(error))
                })
            })
            admin.database().ref('users/'+uid+"/notification").child(nid).transaction(function(datas){
                return datas+1;
            })
        })
})
exports.newuser = functions.database.ref('/users/{uid}/devicetoken').onCreate(event=>{
        const {uid} = event.params;
        const nid = event.data.val();
        console.log(`new user ${uid}:${nid}`);
        return admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'welcome',text:'Welcome!'})
})
exports.trendee_job = functions.pubsub.topic('trendee-tick').onPublish((event) => {
    console.log("This job is ran every 10 mins!")
    admin.database().ref('/challenge').once('value',function(currentday){
        let curry=currentday.val().y;
        let currm=currentday.val().m;
        let currd=currentday.val().d;
        let y=new Date().getUTCFullYear();
        let m=new Date().getUTCMonth();
        let d=new Date().getUTCDate();
        if(new Date(y,m,d-2).getDate()===currd){
            admin.database().ref('/challenge').set({y:y,m:m+1,d:d});
            let returnarray=[];
            const pointarray = [{point:1000},{point:5000},{point:15000},{point:50000},{point:100000},{point:200000},{point:350000},{point:500000}];
            let yy=new Date(y,m,d-2).getFullYear();
            let mm=new Date(y,m,d-2).getMonth()+1;
            let dd=new Date(y,m,d-2).getDate();
            if(mm<10)mm="0"+mm;
            if(dd<10)dd="0"+dd;
            const challengeday=yy+mm+dd;
            console.log(challengeday);
            let num=0;
            admin.database().ref('/users').once('value',function(snapshot){
                var usernum = snapshot.numChildren();
                console.log(`usernum:${usernum}`);
                snapshot.forEach(function(data){
                    if(data.val().devicetoken!==""){
                        const uid=data.key;
                        const nid=data.val().devicetoken;
                        console.log(`end challenge ${uid}:${nid}`);
                        admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'end',text:'See the results of the challenge!',id:challengeday}).then(
                            ()=>{
                                console.log(`new challenge ${uid}:${nid}`);
                                admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'start',text:'Welcome! New challenge.'});
                            }
                        );
                        num++;
                        admin.database().ref('/publication/'+challengeday).once('value',function(dataarray){
                            var maxvote=0,maximage='',maximagetime=0,piccount=0,maxuser=0;
                            var picnum=dataarray.numChildren();
                            dataarray.forEach(function(resultdata){
                                if(resultdata.val().userid===data.key){
                                    var totalvote=resultdata.val().totalnumber===undefined?0:resultdata.val().totalnumber;
                                    var uploadedtime = parseInt(resultdata.key,10);
                                    var voteuser = resultdata.numChildren();
                                    if(totalvote>maxvote){
                                        maxvote=totalvote;
                                        maximagetime = uploadedtime;
                                        maxuser = voteuser;
                                    }else if(totalvote===maxvote && voteuser>maxuser){
                                        maximagetime = uploadedtime;
                                        maxuser = voteuser;
                                    }else if(totalvote===maxvote && voteuser===maxuser && uploadedtime>maximagetime){
                                        maximagetime=uploadedtime;
                                        maxuser = voteuser;
                                    }
                                }
                                piccount++;
                                if(piccount===picnum){
                                    returnarray.push({
                                        userid:uid,
                                        totalvote:maxvote,
                                        votetime:maximagetime,
                                        nid:nid,
                                        voteuser:maxuser
                                    })
                                    if(returnarray.length===usernum){
                                        let array=returnarray.sort((a,b)=>{
                                            if(a.totalvote!==b.totalvote){
                                                return b.totalvote-a.totalvote
                                            }else if(a.voteuser!==b.voteuser){
                                                return b.voteuser-a.voteuser
                                            }else{
                                                return a.votetime-b.votetime
                                            }
                                        })
                                        let count =0;
                                        if(array.length>0 && array[0].totalvote>0){
                                            count++;
                                            console.log(`${array[0].userid} win ${count}`);
                                            admin.database().ref('/notification/'+array[0].userid+'/'+array[0].nid).child(Date.now()).set({type:'bonus',text:'Bravo! You won a bonus!',id:count});
                                            admin.database().ref('/users/'+array[0].userid).once('value',function(temp){
                                                let points = temp.val().points;
                                                let level = temp.val().level;
                                                admin.database().ref('/users/'+ array[0].userid).child('points').set(points+350);
                                                if(points+350>=pointarray[level].point){
                                                    admin.database().ref('/users/'+ array[0].userid).child('level').set(level+1);
                                                }
                                            })
                                        }
                                        if(array.length>1 && array[1].totalvote>0){
                                            count++;
                                            console.log(`${array[1].userid} win ${count}`)
                                            admin.database().ref('/notification/'+array[1].userid+'/'+array[1].nid).child(Date.now()).set({type:'bonus',text:'Bravo! You won a bonus!',id:count});
                                            admin.database().ref('/users/'+array[1].userid).once('value',function(temp){
                                                let points = temp.val().points;
                                                let level = temp.val().level;
                                                admin.database().ref('/users/'+ array[1].userid).child('points').set(points+75);
                                                if(points+75>=pointarray[level].point){
                                                    admin.database().ref('/users/'+ array[1].userid).child('level').set(level+1);
                                                }
                                            })
                                        }
                                        if(array.length>2 && array[2].totalvote>0){
                                            count++;
                                            console.log(`${array[2].userid} win ${count}`)
                                            admin.database().ref('/notification/'+array[2].userid+'/'+array[2].nid).child(Date.now()).set({type:'bonus',text:'Bravo! You won a bonus!',id:count});
                                            admin.database().ref('/users/'+array[2].userid).once('value',function(temp){
                                                let points = temp.val().points;
                                                let level = temp.val().level;
                                                admin.database().ref('/users/'+ array[2].userid).child('points').set(points+50);
                                                if(points+50>=pointarray[level].point){
                                                    admin.database().ref('/users/'+ array[2].userid).child('level').set(level+1);
                                                }
                                            })
                                        }
                                    }
                                }
                            })
                        })
                    }
                })
            })
        }
    }) 
});
exports.getmax = functions.database.ref('/publication/{challenge}/{publishtime}/{otherid}').onUpdate(event=>{
    const {challenge,publishtime,otherid} = event.params;
    const votenumber = event.data.val();
    if ( otherid !== 'totalnumber'){
        if(votenumber === 50){
            console.log(`vote 50 ${otherid}`)
            admin.database().ref('/publication/'+challenge+'/'+publishtime).once('value',function(data){
                const uid = data.val().userid;
                admin.database().ref('/users/'+uid).once('value',function(snapshot){
                    const nid = snapshot.val().devicetoken;
                    admin.database().ref('/users/'+otherid).once('value',function(result){
                        const text = result.val().nickname;
                        console.log(`${text} love ${uid}`);
                        admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'maxvote',text:text,id:otherid});
                    })
                })
            })
        }
    }
})
exports.followed =  functions.database.ref('/follow/{uid}/follower/{otherid}').onCreate(event=>{
    const {uid,otherid} = event.params;
    admin.database().ref('/users/'+uid).once('value',function(snapshot){
        const nid = snapshot.val().devicetoken;
        admin.database().ref('/users/'+otherid).once('value',function(result){
            const text = result.val().nickname;
            console.log(`${text} follow ${uid}`);
            return admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'follow',text:text,id:otherid});
        })
    })
})
exports.levelup = functions.database.ref('/users/{uid}/level').onUpdate(event=>{
    const {uid} = event.params;
    const level = event.data.val();
    const status = ['Beginner','FASHIONISTA','PLUGGED','INFLUENCER','CONFIRMED INFLUENCE','TOP INFLUENCER','ICON','VIP'];
    if(level>event.data.previous.val()){
        admin.database().ref('/users/'+uid).once('value',function(snapshot){
            const nid = snapshot.val().devicetoken;
            const text = status[level];
            console.log(`${uid} reach ${text}`);
            return admin.database().ref('/notification/'+uid+'/'+nid).child(Date.now()).set({type:'level',text:text,id:level});
        })
    }
})
