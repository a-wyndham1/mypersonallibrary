import mongoose from 'mongoose';

const Book = new mongoose.Schema({
    ownerUsername: String,
    title: String,
    author: String,
    status: String
});

const Bookshelf =  new mongoose.Schema({
    shelfTitle: String,
    books: [Book]
});

const User = new mongoose.Schema({
    name: {type: String, required: true},
    username: {type: String, required: true, minLength: 8},
	password: {type: String, required: true, minLength: 8}, //hashed
    bookshelves: {type: [Bookshelf]}
});

mongoose.model('User', User);
mongoose.model('Book', Book);

mongoose.connect(process.env.DSN);
