const express = require("express");
const connectDb = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const initializeSocket = require("./utils/socket");

const dotenv = require("dotenv");
dotenv.config();

//we are not scheduling any cron job so commenting it out
require("./utils/cronjob");

//middleware
//adding cors options
const allowedOrigins = [
    "http://localhost:5173",
    "https://www.connectify.icu",
    "http://52.54.226.144",
    "https://connectify.icu",
];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error("CORS policy: Origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "X-CSRF-Token", "X-Requested-With", "Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Api-Version"],
}));
//it reads the json object ,converts it to javascript object add the js object back to req body.
app.use(express.json());
//adding cookie parser middleware
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/requests");
const userRouter = require("./routes/user");
const paymentRouter = require("./routes/payment");
const chatRouter = require("./routes/chat");
const adminRouter = require("./routes/admin");


//suppose a user comes and hits /signup then first it will come here
// "/" means it matches all the routes it will first go to authRouter then it will check and match if singup matches there
//then it will match at signup and there we are doing res.send so it will end there and dont move any further.
app.use("/",authRouter);
app.use("/",profileRouter);
app.use("/",requestRouter);
app.use("/",userRouter);
app.use("/",paymentRouter);
app.use("/",chatRouter);
app.use("/",adminRouter);

//creating server using http and this app is express app we made
//we will do server.listen instead of app.listen,dont forget to change it to server.listen
const server = http.createServer(app);

initializeSocket(server);

//Get user by email
// app.get("/user",async (req,res)=>{
//     const userEmail = req.body.emailId;
//     try{
//         const users = await User.find({emailId:userEmail});
//         if(users.length===0){
//             res.status(404).send("USer Not Found!!");
//         }
//         else res.send(users);
//     }catch(err){
//         res.status(400).send("Somrthing went wrong!!")
//     }
// })

//FEED API - GET  /feed - get all the users from the database
// app.get("/feed",async (req,res)=>{
    
//     try{
//         const users = await User.find({});
//         res.send(users);
//     }catch(err){
//         res.status(401).send("Something went wrong!!");
//     }
// })

//deleting user by id
// app.delete("/user",async (req,res) => {
//     const userId = await req.body.userId;
//     // const data = req.body;
//     try{
//         const user = await User.findByIdAndDelete({_id:userId });
//         // const user = await User.findByIdAndDelete(userId);
//         res.send( "User Deleted Successfully");
//     }catch(err){
//         res.status(400).send("Something wrong happened.")
//     }
// });

//update data of the user
// app.patch("/user/:userId",async(req,res) => {
//     const userId = req.params?.userId;
//     const data = req.body;
//     // const email = req.body.email;

//     try{
//         const ALLOWED_UPDATES = [
//             "userId","photoUrl","about","gender","age","skills"
//         ]
//         //every key in updated object should be there in our allowed_updates array
//         //if it is not then we will not allow to update
//         //if sending random things update will not be allowed
//         const isUpdateAllowed = Object.keys(data).every(k => 
//             ALLOWED_UPDATES.includes(k)
//         );
    
//         if(!isUpdateAllowed){
//             throw new Error("Update is not allowed.")
//         }

//     //updating data by id
//     //setting options in third argument in findByUpdate
//     //returnDocument will give us the old data before updation
//     //run validators will run validation while doing update
//       const user = await User.findByIdAndUpdate({_id:userId},data,{
//         returnDocument:"after",
//         runValidators:true,
//       });
//     //updating data by email id
//     // await User.findOneAndUpdate({emailId:email},data);
//       res.send("User updated successfully.");
//     }catch(err){
//       res.status(400).send("Update failed:"+err.message);
//     }
// })

connectDb().then(()=>{
    console.log("Database Connected....");
    //listening when our databse in connected successfully 
    //so that whenever user hits any api or service that involves some db ,there is no problem
    server.listen(process.env.PORT,()=>{
        console.log("listening on port 7777");
    })
})
.catch((err) => {
    console.log("Database cannot be established.")
})





