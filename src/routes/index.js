const express = require('express');
const router = express.Router();
const multer = require('multer');
const async = require('async');
const uuid = require("uuid");
const path = require("path");
const fs = require("fs");

//Config Modules
const { checkType } = require("../config/checkType");

//Mongoose Schemas
const Mail = require("../models/Mail");

//Nodemailer Account
const { contact, contactAdmin } = require("../account/nodemailer");


//Route for Homepage
router.get('/',(req, res)=>{
    res.render("index")
})

//Establish Storage for file upload (Contact Us issues)
const storage = multer.diskStorage({
	destination: function(req,file,cb){
		// console.log(req.body);
		const newDestination = __dirname+`/../../public/upload/report/${req.body.email}`;
		console.log("New Destination: ", newDestination);
		var stat = null;
		try{
			stat = fs.statSync(newDestination);
		}
		catch(err){
			fs.mkdir(newDestination,{recursive:true},(err)=>{
				if(err)
					console.error('New Directory Error: ',err);
				else
					console.log('New Directory Success');
			})
		}
		if(stat && !stat.isDirectory())
			throw new Error('Directory Couldnt be created');
		cb(null,newDestination);
	},
	filename:function(req,file,cb){
		cb(null,file.fieldname + '-' + uuid.v4() + path.extname(file.originalname));
	}
});

const upload = multer({
	storage:storage,
	limits:{fileSize:1000000},
	fileFilter:function(req,file,cb){
		checkType(file,cb);
	}
}).array('issues',4);

//Post Route to send mail for any issues
router.post('/contact',async (req,res)=>{
	let errors = [];
	let avatar = [];
	async.each(['issues'],(item,cb)=>{
		upload(req,res,(err)=>{
			if(err){
				errors.push({message:err});
				console.log('Error: ',errors);
				avatar = [];
				cb(avatar);
			}
			else{
				console.log('Files sent: ',req.files);
				if(req.files.length === 0 || req.files === undefined){
					avatar = ['admin'];
					errors.push({message:'0 image selected'});
					console.log('Error2 ',errors);
					cb(avatar);
				}
				else{
					for(var i=0;i<req.files.length;i++){
						avatar[i] = `/report/${req.body.email}/${req.files[i].filename}`;
					}
					console.log(avatar);
					cb(avatar);
				}
			}
		})
	},(avatar)=>{
		if(avatar.length === 0)
			res.redirect('/dsc/?flag=false&error=only 3 images upto 1MB total size is allowed');
		else{
			console.log(req.body);
			contact({
				email:req.body.email,
				name:req.body.name,
				message:req.body.message,
				subject:req.body.subject
			});
			const newMail = new Mail({
				email:req.body.email,
				name:req.body.name,
				message:req.body.message,
				subject:req.body.subject
			});
			if(avatar[0] != 'admin'){
				var location = ''
				for(var i=0;i<avatar.length;i++){
					location += `${avatar[i]}--`;
				}
				newMail.imageLocation = location;
			}
			contactAdmin({
				email:req.body.email,
				name:req.body.name,
				message:req.body.message,
				subject:req.body.subject,
				img:newMail.imageLocation?'yes':'no'
			});
			newMail.save()
				.then((result)=>{
					console.log(result);
					res.redirect('/dsc/?flag=true')
				})
				.catch((err)=>{
					console.log(err);
					res.redirect('/dsc/?flag=false');
				});
			}
		})
	});

//Export
module.exports = router