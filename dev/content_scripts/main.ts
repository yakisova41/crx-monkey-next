const extensionRoot = document.createElement('div');
extensionRoot.id = 'crxm-root';
document.body.appendChild(extensionRoot);

extensionRoot.innerHTML = `
<div class="container">
      <div class="content">
        <h1 class="title">CRX MONEY</h1>
        <p>Count: <span class="counter">0</span></p>
        <button class="count-up">Count Up</button>
      </div>
</div>
`;

let countC = 0;
const counterC = document.querySelector('.counter')!;
document.querySelector('.count-up')!.addEventListener('click', () => {
  countC++;
  counterC.textContent = countC.toString();
});

