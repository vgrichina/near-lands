export function debounce(fn, timeout) {
    let lastExecutionTime;
    return function debounced() {
        if (lastExecutionTime && Date.now() - lastExecutionTime < timeout) {
            setTimeout(debounced, timeout - (Date.now() - lastExecutionTime));
            return;
        }

        lastExecutionTime = Date.now();
        fn();
    }
}