import MicroModal from 'micromodal'

export function loginWithNEAR() {
    const dialogNode = document.createElement('div');
    dialogNode.innerHTML = `
        <div class="modal micromodal-slide" id='onboard-near-login' aria-hidden="true">
            <div class="modal__overlay" tabindex="-1" data-micromodal-close>
                <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-1-title">
                <header class="modal__header">
                    <h2 class="modal__title" id="modal-1-title">
                    Select a wallet
                    </h2>
                    <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
                </header>
                <main class="modal__content">
                    <ul>
                        <li>NEAR Wallet
                        <li>NEAR Wallet (staging)
                        <li>Narwallets
                    </ul>
                    <h3>Use custom wallet</h3>
                    <input type="url" placeholder="https://wallet.near.org">
                </main>
                <footer class="modal__footer">
                    <button class="modal__btn modal__btn-primary">Continue</button>
                    <button class="modal__btn" data-micromodal-close aria-label="Close this dialog window">Close</button>
                </footer>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialogNode);
    MicroModal.show('onboard-near-login'); 
}