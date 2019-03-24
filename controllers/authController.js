const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('./../handlers/mail');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed login!',
  successRedirect: '/',
  successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out!');
  res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
  // first check if user is authenticated
  if (req.isAuthenticated()) {
    next(); // they are logged in!
    return;
  }
  req.flash('error', 'Ooops! You must be logged in!');
  res.redirect('/login');
};

exports.forgot = async (req, res) => {
  // 1. See if user exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash('error', 'No account exists with that email');
    return res.redirect('/login');
  }
  // 2. Set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hr from now
  await user.save();
  // 3. Send them an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user,
    subject: 'Password Reset',
    resetURL,
    filename: 'password-reset',
  })
  req.flash('success', `You have been emailed a password reset link.`);
  // 4. Redirect to login page after email login has been sent
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  const user = await User.findOne({ 
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
   });
   if (!user) {
     req.flash('error', 'Password reset is invalid or has expired');
     return res.redirect('/login');
   }
  //  if there is a user, show them the password reset form
  res.render('reset', { title: 'Reset your Password' });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next(); // Keep it going!
    return;
  }
  req.flash('error', 'Passwords do not match!');
  res.redirect('back');
};

exports.update = async (req, res) => {
  const user = await User.findOne({ 
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
   });
   if (!user) {
     req.flash('error', 'Password reset is invalid or has expired');
     return res.redirect('/login');
   }
  //  setPassword uses callbacks, so we use promisify to make it use promises
   const setPassword = promisify(user.setPassword, user);
   await setPassword(req.body.password);
  //  Clear out our reset fields in mongo by setting them to undefined
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  // Pass updated user to passport js and it will automatically log them in
  await req.login(updatedUser);
  req.flash('success', 'Nice! Your password has been reset! You are now logged in!');
  res.redirect('/'); 
};