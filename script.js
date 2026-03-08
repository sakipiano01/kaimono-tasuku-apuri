// シンプルな買い物リマインダー
localStorage.removeItem('appPin'); // PINリセット用（使ったら削除してください）

function hashPin(pin) {
    // 単純なハッシュ (本番では強いアルゴリズムを使う)
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        hash = (hash << 5) - hash + pin.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

document.addEventListener('DOMContentLoaded', () => {
    const debugDiv = document.getElementById('debug-log');
    function log(msg) {
        if (debugDiv) {
            debugDiv.textContent += msg + '\n';
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
        console.log(msg);
    }
    log('DOMContentLoaded fired');
    const form = document.getElementById('item-form');
    const pinOverlay = document.getElementById('pin-overlay');
    const pinInput = document.getElementById('pin-input');
    const pinSubmit = document.getElementById('pin-submit');
    const pinMessage = document.getElementById('pin-message');
    
    // wrapper for localStorage with logging
    function storageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            log('storageGet error ' + key + ': ' + e);
            return null;
        }
    }
    function storageSet(key, val) {
        try {
            localStorage.setItem(key, val);
        } catch (e) {
            log('storageSet error ' + key + ': ' + e);
        }
    }

    // PINロック処理
    function checkPin() {
        const stored = storageGet('appPin');
        log('checkPin stored=' + stored);
        if (!stored) {
            pinMessage.textContent = '新しいPINを設定してください';
        }
        // 共通のハンドラを用意
        pinSubmit.addEventListener('click', () => {
            pinMessage.textContent = 'ボタンが押されました…';
            const pin = pinInput.value.trim();
            const currentStored = storageGet('appPin');
            log('pin submit clicked stored=' + currentStored + ' pin=' + pin);
            if (!/^[0-9]{4,6}$/.test(pin)) {
                pinMessage.textContent = '4〜6 桁の数字を入力してください';
                pinInput.value = '';
                pinInput.focus();
                return;
            }
            if (!currentStored) {
                storageSet('appPin', hashPin(pin));
                pinOverlay.style.display = 'none';
                return;
            }
            if (hashPin(pin).toString() === currentStored) {
                pinOverlay.style.display = 'none';
            } else {
                pinMessage.textContent = 'PINが違います';
                pinInput.value = '';
            }
        });
        // EnterキーでOKと同じ挙動
        pinInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                pinSubmit.click();
            }
        });
        // モバイルでキーボード表示時に隠れないようスクロール
        pinInput.addEventListener('focus', () => {
            setTimeout(() => {
                pinInput.scrollIntoView({behavior: 'smooth', block: 'center'});
            }, 300);
        });
    }
    checkPin();

    const input = document.getElementById('item-input');
    const timeInput = document.getElementById('reminder-time');
    const list = document.getElementById('item-list');

    let items = JSON.parse(localStorage.getItem('items') || '[]');

    // 通知権限をリクエスト
    if (window.Notification && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    function save() {
        localStorage.setItem('items', JSON.stringify(items));
    }

    function render() {
        list.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            const text = document.createElement('span');
            text.textContent = item.text;
            li.appendChild(text);

            if (item.time) {
                const timeSpan = document.createElement('span');
                timeSpan.textContent = new Date(item.time).toLocaleString();
                timeSpan.style.marginLeft = '1rem';
                li.appendChild(timeSpan);
            }

            const doneBtn = document.createElement('button');
            doneBtn.textContent = '完了';
            doneBtn.addEventListener('click', () => {
                items = items.filter(i => i.id !== item.id);
                save();
                render();
            });
            li.appendChild(doneBtn);

            list.appendChild(li);
        });
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const timeValue = timeInput.value;
        const reminder = timeValue ? new Date(timeValue).getTime() : null;
        const newItem = {
            id: Date.now(),
            text,
            time: reminder,
            notified: false
        };
        items.push(newItem);
        save();
        render();
        form.reset();
    });

    function checkReminders() {
        const now = Date.now();
        items.forEach(item => {
            if (item.time && !item.notified && now >= item.time) {
                notify(item);
                item.notified = true;
                save();
            }
        });
    }

    function notify(item) {
        const message = `買い物: ${item.text}`;
        if (window.Notification && Notification.permission === 'granted') {
            new Notification('リマインダー', { body: message });
        } else {
            alert(message);
        }
    }

    // サービスワーカー登録
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW登録失敗', e));
    }

    // 定期的にチェック
    setInterval(checkReminders, 60 * 1000);
    render();
});
