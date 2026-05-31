const express = require("express");
const profileRouter = express.Router();
const {userAuth} = require("../middlewares/auth")
const {validateEditProfileData,validateUpdatedPassword} = require("../utils/validation");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { uploadProfilePhoto } = require("../utils/cloudinary");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req,file,cb) => {
        if(file.mimetype.startsWith("image/")){
            return cb(null,true);
        }
        cb(new Error("Only image files are allowed"));
    },
});

//profile
profileRouter.get("/profile/view",userAuth,async(req,res)=>{
    try{
         const user = req.user;
         res.send(user); 
     }catch(err){
         res.status(400).send("ERROR : "+err.message);
     }
 })

//profile update
profileRouter.patch("/profile/edit",userAuth,async (req,res) => {
   try{ 
    if(!validateEditProfileData(req)){
        throw new Error("Invalid Edit Request");
    }
    
    //getting user from userAuth
    const loggedInUser = req.user;
    
    Object.keys(req.body).forEach(key => loggedInUser[key] = req.body[key]);
    
    //logged in user instance we have
    await loggedInUser.save();

    res.json({
        message : `${loggedInUser.firstName},your profile updated successfully`,
        data : loggedInUser,
    });

   }catch(err){
     res.status(400).send("ERROR : "+err.message);
   }
})

profileRouter.post("/profile/photo",userAuth,(req,res,next) => {
    upload.single("photo")(req,res,(err) => {
        if(err){
            return res.status(400).json({message:err.message});
        }
        next();
    });
},async (req,res) => {
   try{
    if(!req.file){
        return res.status(400).json({message:"Please upload an image file"});
    }

    if(!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET){
        return res.status(500).json({message:"Cloudinary is not configured"});
    }

    const loggedInUser = req.user;
    const uploadedPhoto = await uploadProfilePhoto(req.file.buffer, loggedInUser._id);

    loggedInUser.photoUrl = uploadedPhoto.secure_url;
    await loggedInUser.save();

    res.json({
        message:"Profile photo uploaded successfully",
        photoUrl:loggedInUser.photoUrl,
        data:loggedInUser,
    });
   }catch(err){
     res.status(400).json({message:err.message});
   }
})

//profile ,forgot password
profileRouter.patch("/profile/forgotPassword",userAuth,async (req,res) => {
    try{
        if(!validateUpdatedPassword(req)){
           throw new Error("Password is not strong!!");
        }

        const {password} = req.body;

        const updatedPasswordHash = await bcrypt.hash(password,10);

        const loggedInUser = req.user;

        // Object.keys(req.body).forEach(key => loggedInUser[key]=updatedPasswordHash);
        loggedInUser.password = updatedPasswordHash;

        await loggedInUser.save();

        res.json({
            message : `${loggedInUser.firstName},your password has been updated successfully.`,
            data : loggedInUser,
        })

    }catch(err){
      res.status(400).send("ERROR : "+err.message);
    }
})

module.exports = profileRouter;
