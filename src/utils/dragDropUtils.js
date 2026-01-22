(function (window) {
    const UniversalDragDrop = {
        /**
         * Sets up drag and drop functionality for a container and a hidden file input.
         * @param {HTMLElement} dropZone - The container element to accept drops.
         * @param {HTMLInputElement} fileInput - The file input element to sync with.
         * @param {Function} onFilesSelected - Callback function receiving the FileList.
         * @returns {Object} Object containing a teardown method to remove listeners.
         */
        setup(dropZone, fileInput, onFilesSelected) {
            if (!dropZone || !fileInput) return;

            const highlight = () => dropZone.classList.add('drag-over');
            const unhighlight = () => dropZone.classList.remove('drag-over');

            const handleDragOver = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                highlight();
                // console.log('Drag over'); // Too noisy
            };

            const handleDragEnter = (e) => {
                e.preventDefault();
                e.stopPropagation();
                highlight();
            };

            const handleDragLeave = (e) => {
                e.preventDefault();
                e.stopPropagation();
                unhighlight();
            };

            const handleDrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                unhighlight();
                console.log('Drop event detected');
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    console.log('Files dropped:', dt.files.length, dt.files[0].name);
                    fileInput.files = dt.files;
                    if (onFilesSelected) onFilesSelected(dt.files);
                } else {
                    console.log('No files found in drop data');
                }
            };



            const handleInputChange = (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    if (onFilesSelected) onFilesSelected(e.target.files);
                }
            };

            dropZone.addEventListener('dragenter', handleDragEnter);
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.addEventListener('drop', handleDrop);
            fileInput.addEventListener('change', handleInputChange);

            dropZone.addEventListener('click', (e) => {
                // Since it's a label, we don't need manual click unless preventing default
                // But for safety with complex children, we leave native behavior
            });

            return {
                teardown() {
                    dropZone.removeEventListener('dragenter', handleDragEnter);
                    dropZone.removeEventListener('dragover', handleDragOver);
                    dropZone.removeEventListener('dragleave', handleDragLeave);
                    dropZone.removeEventListener('drop', handleDrop);
                    fileInput.removeEventListener('change', handleInputChange);
                }
            };
        }
    };

    window.UniversalDragDrop = UniversalDragDrop;
})(window);
