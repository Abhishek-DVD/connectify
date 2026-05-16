const express = require("express");
const authRouter = express.Router();
const {User} = require("../models/user");
const {validateSignupData,validateLoginData} = require("../utils/validation");
const bcrypt = require("bcrypt");

const isProduction = process.env.NODE_ENV === "production";

const getCookieOptions = (days = 7) => ({
    sameSite: isProduction ? "None" : "Lax",
    httpOnly: true,
    secure: isProduction,
    path: "/",
    expires: new Date(Date.now() + days * 24 * 3600000),
});

const clearCookieOptions = {
    sameSite: isProduction ? "None" : "Lax",
    httpOnly: true,
    secure: isProduction,
    path: "/",
};

//Router and app have almost same logic
//so app.use() and authRouter.use() are almost same,they are same thing

//signup api
authRouter.post("/signup",async (req,res)=>{
    try{ 
        //1. validation of data , 
        validateSignupData(req);

        const {firstName,lastName,emailId,password,skills,photoUrl} = req.body;

        // 2.Encrypt the password
        const passwordHash = await bcrypt.hash(password,10);
        
        //creating a new instance of this User model
        const user = new User({
            firstName,
            lastName,
            emailId,
            password:passwordHash,
            skills,
            photoUrl,
        });

        //data will get saved on db,it will return us a promise
        const savedUser = await user.save();
        const token = await user.getJWT();
 
         //Add the token to cookie
        res.cookie("token", token, getCookieOptions(7));

        //send the response back to user
        res.json({message:"User Added Successfully!",data:savedUser});

    }catch(err){
        res.status(400).send("Error saving the user:"+err.message);
    }
  
});

//login api
authRouter.post("/login",async (req,res)=>{
    try{
     validateLoginData(req);
      const {emailId,password} = req.body;
      //first checking wether email id is present is database or not
      //wether there is user or not
      //then we check the password entered and the one present in db
      //if both of them are matching then login Successfull
      const user = await User.findOne({emailId:emailId});
      if(!user){
         //dont expose your data by telling email id not present in db
         // throw new Error("EmailId is not present in DB");
 
         //just tell invaid credentials
         throw new Error("Invalid Credentials");
      }
      const isPasswordValid = await user.checkPassword(password);
 
      if(isPasswordValid){
         //Create a JWT Token
         //offloaded our logic to schema methods
         const token = await user.getJWT();
 
         //Add the token to cookie and send the response back to user
          res.cookie("token", token, getCookieOptions(7));
          res.send(user);
      }else{
         throw new Error("Password is not Correct.")
      }
 
    }catch(err){
     res.status(400).send("ERROR : " + err.message);
    }
 })

//login for admin
authRouter.post("/admin/login",async(req,res)=>{
    try{
     validateLoginData(req);
     const {emailId,password} = req.body;

     const user = await User.findOne({emailId});
     if(!user){
        throw new Error("Invalid Credentials");
     }

     const isPasswordValid = await user.checkPassword(password);
     if(!isPasswordValid) throw new Error("Password is not Correct");

     if(!user.isAdmin) throw new Error("You dont have admin access");

     const token = await user.getJWT();

     res.cookie("adminToken", token, getCookieOptions(2));

     res.send(user);
    }catch(err){
      res.status(400).send("ERROR:"+err.message);
    }
})

//logout api
authRouter.post("/logout",async(req,res)=>{
    // Clear the auth cookie with the same attributes used when it was set.
    res.clearCookie("token", clearCookieOptions);

    // Also clear adminToken when logging out from the same endpoint.
    res.clearCookie("adminToken", clearCookieOptions);

    res.send();
})


module.exports = authRouter;