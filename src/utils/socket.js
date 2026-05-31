const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");
const ConnectionRequestModel = require("../models/connectionRequest");
const { User } = require("../models/user");



const getSecretRoomId = (userId,targetUserId) => {
   return crypto
   .createHash("sha256")
   .update([userId,targetUserId].sort().join("_"))
   .digest("hex");
}

const initializeSocket = (server) => {

const allowedOrigins = [
    "http://localhost:5173",
    "https://www.connectify.icu",
    "https://connectify.icu",
    "https://connectify-web-three.vercel.app",
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}
  
const io = socket(server,{
    cors: { 
        origin: allowedOrigins,
        credentials : true,
    },
})

let onlineUsers  = new Map();

//addding connection,or listening to connections
//whenever you will receive the connection ,these handlers will be called
io.on("connection",(socket) => { 
    //Handle events
    
    //different types of handlers
    socket.on("joinChat",async ({userId,targetUserId})=>{
       //checking wether target user is connected to user or not
       //if not then they cannot chat.
       //using the or query to check relation user->targetUser targetUser->user
       const targetUser = await ConnectionRequestModel.findOne({
        $or:[
          
          {fromUserId : userId,
        toUserId : targetUserId,
        status : "accepted"},
        
        {fromUserId : targetUserId,
          toUserId : userId,
          status : "accepted"},
        ]
       })
       if(!targetUser){
        socket.emit("error",{errorMessage : "You are not connected to this user !!!"})
       } 
       //you create a seperate room,this room should have a seperate id
       const roomId = getSecretRoomId(userId,targetUserId);
    //    console.log("Joining room : " + roomId);
       socket.join(roomId);
    }) 

    socket.on("userOnline", async ({ userId ,targetUserId}) => {
          //storing socket.id ,When a user connects to your WebSocket server, 
          // each connection gets a unique socket.id assigned by socket.io.
          onlineUsers.set(userId,socket.id);
 
          //update the users online status in database
          await User.findByIdAndUpdate(userId,{isOnline:true});

          const status = onlineUsers.has(targetUserId) ? true : false;
          io.emit("updateOnlineStatus", {status : status});
  });

  socket.on("userOffline", async ({ userId }) => {
        onlineUsers.delete(userId);

        // Update lastSeen timestamp in the database when user goes offline
        await User.findByIdAndUpdate(userId,{isOnline:false,lastSeen:new Date()});

        io.emit("updateOnlineStatus", {status : false});
});

    socket.on("sendMessage",async ({firstName,lastName,userId,targetUserId,text})=>{
        //Save message to database
        const roomId = getSecretRoomId(userId,targetUserId);
        try{

          let chat = await Chat.findOne({
            //where all the participants are in the room
            participants : {$all : [userId,targetUserId]},
          })
          if(!chat){
            chat = new Chat({
                participants : [userId,targetUserId],
                messages:[],
            })
          }

          chat.messages.push({
            senderId:userId,
            text,
            status:"sent",
          })

          await chat.save();
          //extracting last message from chats of current user.
          //then extracting the message id and passing on
          const savedMessage = chat.messages[chat?.messages.length-1];
          io.to(roomId).emit("messageReceived",{senderId: userId,firstName,lastName,text,messageId:savedMessage._id,status:"sent"});
        }catch(err){
            console.log(err);
        }
    })

    socket.on("messageSeen",async({userId,targetUserId})=>{
        try{
          //basically this query filters
          //if both targetuser and user are the participants of the chat
          //then checks if senderId is equal to targetUserId this ensures that it is coming from targetUser
          //then we update,$set updates based on matching condition 
          //$[] is the array filter operator, which updates all elements inside messages.
          // This means that every message in the chat that was sent by targetUserId will have its status changed to "seen"
          // {new : true} , Returns the updated document instead of the old one after applying the changes.

          const chat = await Chat.findOneAndUpdate(
            {participants : { $all : [userId,targetUserId] }, 
               "messages.senderId" : targetUserId },
            {$set : {"messages.$[].status":"seen"}},
            {new : true}
          );

          if(chat){
            io.to(onlineUsers.get(targetUserId)).emit("updateMessageStatus",{
              status:"seen"
            });
          }
        }catch(err){
           console.log("Error updating seen status:",error);
        }
    })

    socket.on("disconnect",async ()=>{
      //just checking for all the online users ,wether there is any user
      //which has socket id same as the socket id which is getting disconnected
      //then we delete it from the online users.
       const userId = [...onlineUsers.keys()].find(id => onlineUsers.get(id) === socket.id);

       if(userId){
        onlineUsers.delete(userId);
        await User.findByIdAndUpdate(userId,{isOnline:false,lastSeen: new Date()});
       }
       io.emit("updateOnlineStatus", {status : false});
    })
})

}

module.exports = initializeSocket;
