const exp = require('express');
const app = exp();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.set('view engine',"ejs");
app.use(exp.json());
app.use(exp.urlencoded({extended: true}));
app.use(cookieParser());

app.get("/",(req,res)=>{
    res.render('index');
});

//Creating the User account.
app.post("/register",async (req,res)=>{
    let{email,password,age,name ,username} = req.body;

    //Finding user on the basis of email and then storing it to user variable.
    //Main motive is avoiding the duplicasy of the user.
    let user = await userModel.findOne({email});
    if(user) return res.status(500).send("User already there.");

    //Creating user if user is not present by hashing the pasword.
    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async(err,hash)=>{
           let user = await userModel.create({
                username,
                email,
                name,
                age,
                password :hash
            });
            //sending token as a Cookie by wrapping up the data.
            let token = jwt.sign({
                email:email,
                userid:user._id},
                "secretKey"
            )
            res.cookie("token",token);
            res.send("User Registered")
        })
    })
});

//Creating Login Page.
app.get('/login',(req,res)=>{
    res.render('login');
})

app.post("/login",async (req,res)=>{
    let{email,password} = req.body;

    //Finding user on the basis of email.
    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("Something went wrong");

    bcrypt.compare(password,user.password,(err,result)=>{
        if(result) {
            let token = jwt.sign({
                email:email,
                userid:user._id},
                "secretKey"
            )
             res.status(200).redirect('/profile');
        }
        else res.redirect('/login');
    })
}); 

//Creating profile page for a logged in user.
app.get("/profile",isLoggedIn,async(req,res)=>{
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    res.render("profile",{user:user});
})

//Creating logout route
app.get('/logout',(req,res)=>{
    res.cookie("token","");
    res.redirect("/login");
})

//Creating route for making posts
app.post('/post',isLoggedIn,async(req,res)=>{
    let user = await userModel.findOne({email:req.user.email});
    let{content} = req.body;
    let post = await postModel.create({
        user: user._id,
        content,
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect("profile");
});

//creating like route 
app.get('/like/:id',isLoggedIn,async(req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");

    //if the user has not liked the post
    if(post.likes.indexOf(req.user.userid)===-1){
        post.likes.push(req.user.userid);
    }else{
        //if the wants to unlike the post
        post.likes.splice(post.likes.indexOf(req.user.userid),1);
    }
    
    await post.save();
    let user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("profile", { user });
})

//creating edit route
app.get('/edit/:id',isLoggedIn,async(req,res)=>{
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
    res.render("edit",{post});
})

app.post('/update/:id',isLoggedIn,async(req,res)=>{
    let post = await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content});
    res.redirect("/profile");
})

//Adding middlewares for protected routes
function isLoggedIn(req,res,next){
    if(req.cookies.token==="") return res.redirect("/login");
    else{
        let data =  jwt.verify(req.cookies.token,"secretKey")
        req.user = data;
    }
    next();
}
app.listen(3000);