document.addEventListener('DOMContentLoaded', function() {
    // Получаем все элементы с классом state-call
    var elements = document.querySelectorAll('.state-call');

    // Проходимся по всем элементам и добавляем стили
    elements.forEach(function(element) {
        element.setAttribute('style', 'display:none !important');
    });
});
