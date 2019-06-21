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
