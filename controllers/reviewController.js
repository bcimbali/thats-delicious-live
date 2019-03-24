const mongoose = require('mongoose');
const Review = require('./../models/Review');

exports.addReview = async (req, res) => {
  // User Id coming in from logged in user
  req.body.author = req.user._id;
  // Store Id coming in from the URL
  req.body.store = req.params.id;
  const newReview = new Review(req.body);
  await newReview.save();
  req.flash('success', 'Your review was successfully saved!');
  res.redirect('back');
};