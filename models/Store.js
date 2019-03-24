const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  // Anytime a document is converted to either an object or JSON
  // it will bring our virtuals along for the ride
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({
  location: '2dsphere'
})

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); // Skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);

  // Find other slugs that have a slug of store-1, store-2 etc
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  // If there are any matches...
  if(storesWithSlug.length) {
    // ...Override this.slug with the name plus one
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
  // TODO make more resilient so slugs are unique
});

// Need to use an old type declaration of function because THIS is 
// going to be bound to our model
storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags'},
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

storeSchema.statics.getTopStores = function() {
  // Aggregate is a query function like .find() but you can do much more
  // complex stuff inside of it. By returning this, it returns the promise.
  return this.aggregate([
    // Lookup stores and populate their reviews
    { $lookup: {from: 'reviews', 
      localField: '_id', 
      foreignField: 'store', 
      as: 'reviews'}},
    // filter for only items that have 2 or more reviews
    // MongoDB is index based so it searches for stores that have 2 or 
    // more entries. (e.g. the 'reviews.1`)
    { $match: { 'reviews.1': { $exists: true } } },
    // Add the average reviews field
    // Creating a new field called 'averageRating'
    // $project adds a field but doesn't bring the others with it
    // so you need to tell them in explicitly
    { $project: {
      // $$ROOT is equal to the original document
      photo: '$$ROOT.photo',
      name: '$$ROOT.name',
      reviews: '$$ROOT.reviews',
      slug: '$$ROOT.slug',
      averageRating: { $avg: '$reviews.rating' }
    }},
    // Sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 } },
    // limit to at most 10
    { $limit: 10 }
  ]);
};

// Find reviews where the stores _id property === reviews store property
// (kind of like a join in SQL)
/** Important thing to note - Virtual fields don't actually go 
 * into an object or json unless you explicitly ask for it */
storeSchema.virtual('reviews', {
  ref: 'Review', // What model to link?
  localField: '_id', // Which field on our store?
  foreignField: 'store' // Which field on the review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
;}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);