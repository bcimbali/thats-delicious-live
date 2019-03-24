import { $ } from './bling';
import axios from 'axios';

function ajaxHeart(e) {
  e.preventDefault();
  console.log('HEART ITT!!!!!');
  axios
    .post(this.action)
    .then(res => {
      // Since heart is a name on the button in the form, you can grab it with this.heart
      const isHearted = this.heart.classList.toggle('heart__button--hearted');
      $('.heart-count').textContent = res.data.hearts.length;
      if (isHearted) {
        this.heart.classList.add('heart__button--float');
        setTimeout(() => this.heart.classList.remove('heart__button--float'), 2500);
      }
    })
    .catch(console.error);
}

export default ajaxHeart;