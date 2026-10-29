const getAllowedCharacters = (input) => {
    const allowsDecimal = input.type === 'number' || input.inputMode === 'decimal';
    return allowsDecimal ? /^[0-9.]*$/ : /^[0-9]*$/;
};

const isNumericOnlyInput = (target) => (
    target instanceof HTMLInputElement &&
    (target.type === 'number' || target.inputMode === 'numeric' || target.inputMode === 'decimal')
);

export const installAsciiNumericInputGuard = () => {
    const preventInvalidInsertion = (event, insertedText) => {
        if (!isNumericOnlyInput(event.target) || insertedText === null) return;
        if (!getAllowedCharacters(event.target).test(insertedText)) event.preventDefault();
    };

    const handleBeforeInput = (event) => {
        if (event.inputType.startsWith('insert')) {
            preventInvalidInsertion(event, event.data);
        }
    };

    const handlePaste = (event) => {
        preventInvalidInsertion(event, event.clipboardData?.getData('text') ?? null);
    };

    const handleDrop = (event) => {
        preventInvalidInsertion(event, event.dataTransfer?.getData('text') ?? null);
    };

    document.addEventListener('beforeinput', handleBeforeInput, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('drop', handleDrop, true);

    return () => {
        document.removeEventListener('beforeinput', handleBeforeInput, true);
        document.removeEventListener('paste', handlePaste, true);
        document.removeEventListener('drop', handleDrop, true);
    };
};
