const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if(isPhoto) {
      next(null, true);
    } else {
      next({ message: 'That filetype is not allowed!'}, false);
    }
  }
}

exports.homepage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // Check if there is no new file to resize
  if(!req.file) {
    next(); // Skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // Now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the file to our file system, keep going
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;
  const storesPromise = Store
  .find()
  .skip(skip)
  .limit(limit)
  .sort({ created: 'desc' })

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash('info', `Hey! You asked for page ${page}, but that does not exist. I put you on page ${pages}.`)
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  // in order to compare an objectId with an actual string,
  // you have to use the .equals method
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store to edit it!');
  }
}
exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out the edit form so the user can update
  res.render('editStore', { title: `Edit ${store.name}`, store })
};

exports.updateStore = async (req, res ) => {
  // Set the location data to be a point
  req.body.location.type = 'Point';
  // Find and update store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // Return new store instead of returning the old one
    runValidators: true
  }).exec();
  req.flash('success', `Successfully updated <strong>${store.name}</strong> <a href="/stores/${store.slug}">View Store</a>`);
  // Redirect them to store and tell them it worked
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  // Find store by slug
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
  if (!store) return next();
  res.render('store', { store, title: store.name })
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tag', { tags, title: 'Tags', tag, stores })
};

exports.searchStores = async (req, res) => {
  const stores = await Store
  // First find stores that match
  .find({
    $text: {
      $search: req.query.q
    }
  }, {
    score: { $meta: 'textScore'}
  })
  // Then, sort them
  .sort({
    score: { $meta: 'textScore' }
  })
  // limit to only 5 results
  .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  // MongoDB expects us to pass it an array of lat & lng numbers
  // Then, map over the array and use parseFloat to turn them all into numbers
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 //10km
      }
    }
  };
  // Use our query to find our stores and only select the fiels passed in. limit to 10 results.
  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User
    .findByIdAndUpdate(req.user._id, 
      { [operator]: { hearts: req.params.id } },
      // By updating the user, it will return the updated user,
      // rather than the previous user
      { new: true }  
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    // If the id property of the store is in the array of req.user.hearts
    _id: { $in: req.user.hearts }
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  /** Generally it's a good idea to place complex queries in your model.
   * If I was to do a .find() or something similar, that would be fine here.
   */
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: '\u2605 Top Stores!' });
};