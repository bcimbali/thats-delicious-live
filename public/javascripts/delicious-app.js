import '../sass/style.scss';

import { $, $$ } from './modules/bling';

import ajaxHeart from './modules/heart';
import autocomplete from './modules/autocomplete';
import makeMap from './modules/map';

autocomplete($('#address'), $('#lat'), $('#lng'));

makeMap($('#map'));

const heartForms = $$('form.heart');
heartForms.on('submit', ajaxHeart);