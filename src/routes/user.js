const express = require("express");
const { userAuth } = require("../middlewares/auth");
const connectionRequest = require("../models/connectionRequest");
const { User } = require("../models/user");
const userRouter = express.Router();

const USER_SAFE_DATA = "firstName lastName photoUrl age gender about skills"

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//showing received requests
userRouter.get("/user/requests/received",userAuth,async (req,res)=>{
    try{
       
        const loggedInUser = req.user;
        
        //finding all the request of logged in user
        const userRequests = await connectionRequest.find(
            {
                toUserId:loggedInUser._id,
                status:"interested"
            }
        ).populate("fromUserId",["firstName","lastName","photoUrl","age","gender","about","skills"]); //if you dont pass the second parameter it will return the entire object.We dont want overfecthing data
        // .populate("fromUserId firstName lastName photoUrl age gender about skills"]); //both ways are same either use string or array

        res.json({message:"Data send successfully",userRequests});
    }catch(err){
        res.status(400).send("ERROR : "+err.message);
    }
})

//getting connections
userRouter.get("/user/connections",userAuth,async (req,res)=>{
    try{
      const loggedInUser = req.user;
      
      const connections = await connectionRequest.find(
        {   
            //some user made a request and we accepted first case
            //using or query because if we have made the request and it is accepted this is second case
            //so in both cases toUserId and fromUserId should always be loggedInUser to display all connections.
            //A can be sender and receiver both
            $or:[
                {toUserId:loggedInUser._id,status:"accepted"},
                {fromUserId:loggedInUser._id,status:"accepted"}
            ],
        }).populate("fromUserId",USER_SAFE_DATA)
          .populate("toUserId",USER_SAFE_DATA);

        //we only want to display user data and not connectionRequest table data
        const data = connections.map((row) => {
            if(row.fromUserId._id.toString() === loggedInUser._id.toString()){
                return row.toUserId;
            }
            return row.fromUserId;
        });
        res.json({data:data});

    }catch(err){
        res.status(400).send({message:err.message});
    }
})

//search registered users by name
userRouter.get("/user/search",userAuth,async (req,res)=>{
    try{
        const loggedInUser = req.user;
        const query = (req.query.query || "").trim();
        let limit = parseInt(req.query.limit) || 8;
        limit = limit > 20 ? 20 : limit;

        if(query.length < 2){
            return res.json({users:[]});
        }

        const safeQuery = escapeRegex(query);
        const nameRegex = new RegExp(safeQuery,"i");

        const users = await User.find({
            _id: {$ne:loggedInUser._id},
            $or:[
                {firstName:nameRegex},
                {lastName:nameRegex},
            ],
        }).select(USER_SAFE_DATA).limit(limit).lean();

        const searchedUserIds = users.map((user) => user._id);
        const connectionRequests = await connectionRequest.find({
            $or:[
                {fromUserId:loggedInUser._id,toUserId:{$in:searchedUserIds}},
                {fromUserId:{$in:searchedUserIds},toUserId:loggedInUser._id},
            ],
        }).select("fromUserId toUserId status").lean();

        const relationshipByUserId = new Map();
        connectionRequests.forEach((request) => {
            const fromUserId = request.fromUserId.toString();
            const toUserId = request.toUserId.toString();
            const loggedInUserId = loggedInUser._id.toString();
            const otherUserId = fromUserId === loggedInUserId ? toUserId : fromUserId;

            let relationshipStatus = request.status;
            if(request.status === "accepted"){
                relationshipStatus = "connected";
            }else if(request.status === "interested"){
                relationshipStatus = fromUserId === loggedInUserId ? "sent" : "received";
            }

            relationshipByUserId.set(otherUserId,{
                relationshipStatus,
                requestId:request._id,
            });
        });

        const usersWithRelationship = users.map((user) => {
            const relationship = relationshipByUserId.get(user._id.toString()) || {
                relationshipStatus:"none",
            };

            return {
                ...user,
                ...relationship,
            };
        });

        res.json({users:usersWithRelationship});
    }catch(err){
        res.status(400).json({message:err.message});
    }
})

//feed section
userRouter.get("/feed",userAuth,async (req,res)=>{
    try{
     
        //user should see all the user cards except
        //0. his own card
        //1. his connections
        //2.ignored people
        //3.already sent the connection request
        //if entry has already been created for connection req then dont see it

        const loggedInUser = req.user;
        
        //pagination
        //parsing the page number to int as they will be in string,and if page is not there then assume it to be 1
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        limit = limit>50 ? 50:limit;
        const skip = (page-1)*limit;

        //finding all the connection request,that either i have send or received
        const userConnectionRequests = await connectionRequest.find({
            $or:[{fromUserId:loggedInUser._id},{toUserId:loggedInUser._id}],
        }).select("fromUserId toUserId");//select will filter only fromUserId and toUserId

        const hideUsersFromFeed = new Set();
        userConnectionRequests.forEach(req => {
            hideUsersFromFeed.add(req.fromUserId.toString());
            hideUsersFromFeed.add(req.toUserId.toString());
        })
        // console.log(hideUsersFromFeed);
 
        const users = await User.find({
            //all the people in database except the hiddenUsersFromFeed,that is whom we already have connection with
            //$nin ,not in ,$ne not equal to (dont show his own)
            //$and ,both conditions are true.
            $and : [
                {_id: {$nin:Array.from(hideUsersFromFeed)}},
                {_id : {$ne:loggedInUser._id}}
            ],
            _id : {$nin: Array.from(hideUsersFromFeed)}
        }).select(USER_SAFE_DATA).skip(skip).limit(limit);
        res.send(users);
    }catch(err){
        res.status(400).json({ message: err.message});
    }
})

//last seen of user
userRouter.get("/user/last-seen/:userId",async(req,res) => {
    try{
       const user = await User.findById(req.params.userId);
       if(!user){
         return res.status(400).send({message:"User not found"});
       }
       res.json({lastSeen:user.lastSeen});
    }catch(err){
        res.status(500).json({message:"Server Error"});
    }
})

module.exports = userRouter;
