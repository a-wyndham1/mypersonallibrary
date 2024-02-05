import './config.mjs';
import './db.mjs';

import express from 'express';
import path from 'path';
import session from 'express-session';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import sanitize from 'mongo-sanitize';
import validate from 'validate.js'

import pkg from 'bcryptjs';
const { hash, compare } = pkg;
const saltRounds = 10;

const app = express();
app.set('view engine', 'hbs');
app.use(express.urlencoded({extended: false}));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessionOptions = {
    secret: 'secret for signing session id',
    saveUninitialized: false,
    resave: false
}

//form validation constraints for signup
const userConstraints = {
  name: {
    presence: true
  },
  username: {
    presence: true,
    length: {
      minimum: 8,
      message: "username must be 8 characters or longer"
    }
  },
  password: {
    presence: true,
    length: {
      minimum: 8,
      message: "password must be 8 characters or longer"
    }
  }
};

//for adding a book
const addConstraints = {
  title: {
    presence: {
      allowEmpty: false,
      message: 'is required'
    }
  },
  author: {
    presence: {
      allowEmpty: false,
      message: 'is required'
    }
  }
}

//for adding a shelf
const createConstraints = {
  shelfTitle: {
    presence: {
      allowEmpty: false,
      message: 'is required'
    }
  }
}

const User = mongoose.model('User');
const Book = mongoose.model('Book');

app.set('view engine', 'hbs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(session(sessionOptions));

app.use((req, res, next) => {
  if (!req.session.username || req.session.username === "") {
    req.session.username = "not logged in";
  }
  next();
});

app.get('/', (req, res) => {
  if (req.session.username && req.session.username !== "not logged in"){
    res.redirect('/shelves');
  }
  else {
    res.render('home');
  }
  
});

app.get('/logout', (req, res) => {
  req.session.username="not logged in";
  res.redirect('/');
}); 

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req,res) => {
  const currentUser = await User.findOne({username: sanitize(req.body.username)}); 
  if(currentUser) {
    const pwdComp = await compare(sanitize(req.body.password), currentUser.password);
    if (pwdComp){
      req.session.username = sanitize(req.body.username);
      res.redirect('/shelves');
    }
    else {
      res.render('login', {error: "incorrect password"});
    }
  }
  else {
    res.render('login', {error: "user not found"});
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req,res) => {
  const currentUser = await User.findOne({username: sanitize(req.body.username)});
  if (currentUser) {
    res.render('signup', {error: "Username Already Exists"});
  } else {
    //validate form fields first
    const givenName = req.body.name;
    const givenUsername = req.body.username;
    const givenPwrd = req.body.password;

    let error;
    const v = await validate({name: givenName, username: givenUsername, password: givenPwrd}, userConstraints);
    if (v) {
      res.render('signup', v);
    }
    else {
      const u = new User({name: givenName, username: givenUsername, password: await hash(givenPwrd, saltRounds), bookshelves: []});

      try {
        const savedUser = await u.save();    
        req.session.username = givenUsername;
        res.redirect('/shelves');
      } catch (err) {
        error = err;
        res.render('signup', {error: "Error with signin"});
      } 
    }

  }
});

app.get('/shelves', async (req,res) => {
  if (!req.session.username){
    res.redirect('/signup');
  }
  else {
    const currentUser = await User.findOne({username: req.session.username});
    res.render('shelves', {username: currentUser.name, shelves: currentUser.bookshelves});
  }
});

app.get('/books', async (req, res) => {
  if (!req.session.username || req.session.username === 'not logged in'){
    res.redirect('/signup');
  }
  else {
    const currentUser = await User.findOne({username: req.session.username});
    const filterQuery = {ownerUsername: req.session.username};
    if (req.query.titleSort){
      filterQuery.title = req.query.titleSort;
    }
    if (req.query.authorSort){
      filterQuery.author = req.query.authorSort;
    }
    if (req.query.status){
      filterQuery.status = req.query.status;
    }
    const currentBooks = await Book.find(filterQuery);
    res.render('books', {name: currentUser.name, books: currentBooks});
  }
});

app.get('/add', async (req,res) => {
  if (!req.session.username || req.session.username === 'not logged in'){
    res.redirect('/signup');
  }
  else {
    const currentUser = await User.findOne({username: req.session.username});
    res.render('add', {username: currentUser.username, shelves: currentUser.bookshelves});
  }
});

app.post('/add', async (req, res) => {
  const currentUser = await User.findOne({username: req.session.username});

  const v = validate({title: req.body.title, author: req.body.author}, addConstraints)
  if (v) {
    v.shelves = currentUser.bookshelves;
    v.username = req.session.username;
    console.log(v)
    res.render('add', v)
  }
  else {
    const newBook = {ownerUsername: req.session.username, title: req.body.title, author: req.body.author, status: req.body.status};
    const b = new Book(newBook);
    const bSave = await b.save();
    const shelves = currentUser.bookshelves;
    const shelfAdd = shelves.filter((element) => {
      return element.shelfTitle === req.body.shelfTitle;
    });
    shelfAdd[0].books.push(newBook);
    const updatedUser = await User.findOneAndUpdate({username: req.session.username}, {$set: {bookshelves: shelves}});
    res.redirect('/shelves');
  }
});

app.get('/create', async (req,res) => {
  if (!req.session.username || req.session.username === 'not logged in'){
    res.redirect('/signup');
  }
  else {
    const currentUser = await User.findOne({username: req.session.username});
    res.render('create', {username: currentUser.username});
  }
});

app.post('/create', async (req,res) => {
  const v = validate({shelfTitle: req.body.shelfTitle}, createConstraints)
  if (v) {
    v.username = req.session.username;
    res.render('create', v)
  }
  else {
    const newBookshelf = {shelfTitle: req.body.shelfTitle, books:[]};
    const updatedUser = await User.findOneAndUpdate({username: req.session.username}, {$push: {bookshelves: newBookshelf}});
    res.redirect('/shelves');
  }
});

app.get('/shelves/:shelfTitle', async (req,res) => {
  if (!req.session.username){
    res.redirect('/signup');
  }
  else {
    const shelf = req.params.shelfTitle;
    const user = await User.find({username: req.session.username});
    const currentUser = user[0];
    const shelves = currentUser.bookshelves;
    const shelfRender = shelves.filter((element) => {
      return element.shelfTitle === req.params.shelfTitle;
    });

    if (!shelfRender[0].books) {
      res.render('shelves-shelf', {username: currentUser.username, shelfTitle: req.params.shelfTitle});
    }else {
      res.render('shelves-shelf', {username: currentUser.username, shelfTitle: req.params.shelfTitle, books: shelfRender[0].books});
    }
  }

});

app.listen(process.env.PORT ?? 3000);
