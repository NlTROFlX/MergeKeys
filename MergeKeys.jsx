{
    // Функция для отображения сообщения об ошибке и завершения скрипта
    function showError(message) {
        alert("Ошибка: " + message);
        throw new Error(message);
    }

    // Функция для определения количества измерений свойства
    function getNumDimensions(property) {
        var val = property.value;
        if (Array.isArray(val)) {
            return val.length;
        } else if (typeof val === 'object' && val !== null) {
            return Object.keys(val).length;
        } else {
            return 1;
        }
    }

    // Функция для создания массива KeyframeEase с заданным количеством элементов
    function createFlatEaseArray(numDimensions) {
        var flatEase = [];
        for (var d = 0; d < numDimensions; d++) {
            // influence: 1 (минимальное допустимое значение)
            // speed: 1 (минимальное допустимое значение)
            flatEase.push(new KeyframeEase(1, 1));
        }
        return flatEase;
    }

    // Функция для создания и отображения диалогового окна с вариантами действий
    function showDialog(callback) {
        var dialog = new Window("dialog", "Выбор действия");

        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "center"];
        dialog.spacing = 10;
        dialog.margins = 16;

        var infoText = dialog.add("statictext", undefined, "Выберите действие для всех выбранных ключевых кадров:");
        infoText.alignment = ["fill", "top"];

        // Группа с радиокнопками
        var radioGroup = dialog.add("group");
        radioGroup.orientation = "column";
        radioGroup.alignChildren = ["left", "center"];
        radioGroup.spacing = 10;

        var leftRadio = radioGroup.add("radiobutton", undefined, "Left");
        var rightRadio = radioGroup.add("radiobutton", undefined, "Right");
        var splitRadio = radioGroup.add("radiobutton", undefined, "Split");

        // Устанавливаем "Left" по умолчанию
        leftRadio.value = true;

        // Кнопки ОК и Отмена
        var buttonsGroup = dialog.add("group");
        buttonsGroup.orientation = "row";
        buttonsGroup.alignChildren = ["center", "center"];
        buttonsGroup.spacing = 10;

        var okButton = buttonsGroup.add("button", undefined, "OK", {name: "ok"});
        var cancelButton = buttonsGroup.add("button", undefined, "Отмена", {name: "cancel"});

        okButton.onClick = function() {
            if (leftRadio.value) {
                dialog.close(1);
            }
            else if (rightRadio.value) {
                dialog.close(2);
            }
            else if (splitRadio.value) {
                dialog.close(3);
            }
        }

        cancelButton.onClick = function() {
            dialog.close(0);
        }

        var result = dialog.show();
        callback(result);
    }

    // Функция для перемещения ключа на указанное время
    function moveKey(property, selectedKeyIndex, targetKeyTime) {
        // Получаем значения выбранного ключа
        var selectedKeyValue = property.keyValue(selectedKeyIndex);

        // Получаем временные ease (если они есть)
        var inTemporalEase = property.keyInTemporalEase(selectedKeyIndex);
        var outTemporalEase = property.keyOutTemporalEase(selectedKeyIndex);

        // Получаем пространственные тангенты (если применимо)
        var inSpatialTangent = null;
        var outSpatialTangent = null;
        if (property.isSpatial) {
            inSpatialTangent = property.keyInSpatialTangent(selectedKeyIndex);
            outSpatialTangent = property.keyOutSpatialTangent(selectedKeyIndex);
        }

        // Удаляем выбранный ключ
        property.removeKey(selectedKeyIndex);

        // Вставляем новый ключ на целевое время с теми же значениями
        property.setValueAtTime(targetKeyTime, selectedKeyValue);

        // Получаем индекс нового ключа (последний)
        var newKeyIndex = property.numKeys;

        // Восстанавливаем временные ease
        if (inTemporalEase && outTemporalEase) {
            property.setTemporalEaseAtKey(newKeyIndex, inTemporalEase, outTemporalEase);
        }

        // Восстанавливаем пространственные тангенты, если применимо
        if (property.isSpatial && inSpatialTangent && outSpatialTangent) {
            property.setSpatialTangentsAtKey(newKeyIndex, inSpatialTangent, outSpatialTangent);
        }

        return newKeyIndex;
    }

    // Функция для дублирования ключа на указанное время
    function duplicateKey(property, targetKeyTime, selectedKeyIndex) {
        // Получаем значения выбранного ключа
        var selectedKeyValue = property.keyValue(selectedKeyIndex);

        // Получаем временные ease (если они есть)
        var inTemporalEase = property.keyInTemporalEase(selectedKeyIndex);
        var outTemporalEase = property.keyOutTemporalEase(selectedKeyIndex);

        // Получаем пространственные тангенты (если применимо)
        var inSpatialTangent = null;
        var outSpatialTangent = null;
        if (property.isSpatial) {
            inSpatialTangent = property.keyInSpatialTangent(selectedKeyIndex);
            outSpatialTangent = property.keyOutSpatialTangent(selectedKeyIndex);
        }

        // Вставляем новый ключ на целевое время с теми же значениями
        property.setValueAtTime(targetKeyTime, selectedKeyValue);

        // Получаем индекс нового ключа (последний)
        var newKeyIndex = property.numKeys;

        // Восстанавливаем временные ease
        if (inTemporalEase && outTemporalEase) {
            property.setTemporalEaseAtKey(newKeyIndex, inTemporalEase, outTemporalEase);
        }

        // Восстанавливаем пространственные тангенты, если применимо
        if (property.isSpatial && inSpatialTangent && outSpatialTangent) {
            property.setSpatialTangentsAtKey(newKeyIndex, inSpatialTangent, outSpatialTangent);
        }

        // НЕ устанавливаем тип интерполяции в Hold

        return newKeyIndex;
    }

    // Функция для удаления ключа
    function deleteKey(property, keyIndex) {
        property.removeKey(keyIndex);
    }

    // Начало основного скрипта
    app.beginUndoGroup("MergeKeys");

    // Проверяем, есть ли активная композиция
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        showError("Активная композиция не найдена.");
    }

    // Проверяем, есть ли выбранные слои
    if (comp.selectedLayers.length < 1) {
        showError("Пожалуйста, выберите хотя бы один слой.");
    }

    // Собираем все выбранные ключи
    var selectedKeys = [];

    for (var l = 0; l < comp.selectedLayers.length; l++) {
        var layer = comp.selectedLayers[l];

        // Функция для рекурсивного поиска всех выбранных свойств
        function getSelectedProperties(prop) {
            var properties = [];
            if (prop.selected) {
                properties.push(prop);
            }
            if (prop.numProperties) {
                for (var p = 1; p <= prop.numProperties; p++) {
                    var subProp = prop.property(p);
                    properties = properties.concat(getSelectedProperties(subProp));
                }
            }
            return properties;
        }

        var props = getSelectedProperties(layer);

        for (var p = 0; p < props.length; p++) {
            var property = props[p];

            // Проверяем, содержит ли свойство ключевые кадры
            if (!property.isTimeVarying) {
                continue;
            }

            var numKeys = property.numKeys;
            if (numKeys < 1) {
                continue;
            }

            // Собираем все выбранные ключи в свойстве
            for (var k = 1; k <= numKeys; k++) {
                if (property.keySelected(k)) {
                    selectedKeys.push({
                        layer: layer,
                        property: property,
                        keyIndex: k
                    });
                }
            }
        }
    }

    if (selectedKeys.length < 1) {
        showError("Пожалуйста, выберите хотя бы один ключевой кадр.");
    }

    // Чтобы избежать проблем с изменением индексов ключей во время обработки, сортируем ключи по времени, начиная с самых последних
    selectedKeys.sort(function(a, b) {
        var timeA = a.property.keyTime(a.keyIndex);
        var timeB = b.property.keyTime(b.keyIndex);
        return timeB - timeA; // Сортировка по убыванию времени
    });

    // Показываем диалоговое окно один раз и получаем выбранное действие
    showDialog(function(result) {
        if (result === 0) {
            // Пользователь отменил действие
            app.endUndoGroup();
            return;
        }

        // Определяем выбранное действие
        var selectedAction;
        if (result === 1) {
            selectedAction = "Left";
        }
        else if (result === 2) {
            selectedAction = "Right";
        }
        else if (result === 3) {
            selectedAction = "Split";
        }
        else {
            selectedAction = null;
        }

        if (!selectedAction) {
            // Действие не выбрано или отменено
            app.endUndoGroup();
            return;
        }

        // Обработка каждого выбранного ключа
        for (var i = 0; i < selectedKeys.length; i++) {
            var current = selectedKeys[i];
            var layer = current.layer;
            var property = current.property;
            var keyIndex = current.keyIndex;

            // Проверяем, что ключ все еще существует (возможно, был удален при обработке предыдущих ключей)
            if (keyIndex > property.numKeys) {
                continue;
            }

            var keyTime = property.keyTime(keyIndex);

            // Находим ближайшие левые и правые ключи
            var leftKeyIndex = null;
            var rightKeyIndex = null;

            // Поиск левого ключа
            for (var lk = keyIndex - 1; lk >= 1; lk--) {
                leftKeyIndex = lk;
                break;
            }

            // Поиск правого ключа
            for (var rk = keyIndex + 1; rk <= property.numKeys; rk++) {
                rightKeyIndex = rk;
                break;
            }

            // Определяем, находится ли ключ между двумя другими
            var hasLeft = (leftKeyIndex !== null);
            var hasRight = (rightKeyIndex !== null);

            if (selectedAction === "Left") {
                if (hasLeft) {
                    var targetKeyTime = property.keyTime(leftKeyIndex);
                    moveKey(property, keyIndex, targetKeyTime);
                }
                else {
                    // Нет левого ключа для перемещения
                    $.writeln("Ключ на " + keyTime.toFixed(2) + " секунд не имеет левого ключа для перемещения.");
                }
            }
            else if (selectedAction === "Right") {
                if (hasRight) {
                    var targetKeyTime = property.keyTime(rightKeyIndex);
                    moveKey(property, keyIndex, targetKeyTime);
                }
                else {
                    // Нет правого ключа для перемещения
                    $.writeln("Ключ на " + keyTime.toFixed(2) + " секунд не имеет правого ключа для перемещения.");
                }
            }
            else if (selectedAction === "Split") {
                if (hasLeft && hasRight) {
                    var targetKeyTimeLeft = property.keyTime(leftKeyIndex);
                    var targetKeyTimeRight = property.keyTime(rightKeyIndex);
                    var keyValue = property.keyValue(keyIndex);

                    // Получаем временные ease
                    var inTemporalEase = property.keyInTemporalEase(keyIndex);
                    var outTemporalEase = property.keyOutTemporalEase(keyIndex);

                    // Получаем пространственные тангенты
                    var inSpatialTangent = null;
                    var outSpatialTangent = null;
                    if (property.isSpatial) {
                        inSpatialTangent = property.keyInSpatialTangent(keyIndex);
                        outSpatialTangent = property.keyOutSpatialTangent(keyIndex);
                    }

                    // Определяем количество измерений
                    var numDimensions = getNumDimensions(property);
                    $.writeln("Property: " + property.name + ", Num Dimensions: " + numDimensions);

                    // Создаём массив с минимальными значениями KeyframeEase
                    var flatEase = createFlatEaseArray(numDimensions);

                    // Дублируем ключ для левой стороны
                    var newLeftKeyIndex = duplicateKey(property, targetKeyTimeLeft, keyIndex);
                    $.writeln("Дублируем левый ключ: Новый индекс = " + newLeftKeyIndex);

                    // Устанавливаем временные ease дублированного левого ключа на минимальные значения, чтобы избежать кривых
                    if (inTemporalEase && outTemporalEase) {
                        try {
                            property.setTemporalEaseAtKey(newLeftKeyIndex, flatEase, flatEase);
                            $.writeln("Устанавливаем flatEase для левого ключа: " + flatEase.length + " элементов.");
                        } catch (e) {
                            $.writeln("Ошибка при установке temporal ease для левого ключа: " + e.toString());
                        }
                    }

                    // Дублируем ключ для правой стороны
                    var newRightKeyIndex = duplicateKey(property, targetKeyTimeRight, keyIndex);
                    $.writeln("Дублируем правый ключ: Новый индекс = " + newRightKeyIndex);

                    // Устанавливаем временные ease дублированного правого ключа на минимальные значения, чтобы избежать кривых
                    if (inTemporalEase && outTemporalEase) {
                        try {
                            property.setTemporalEaseAtKey(newRightKeyIndex, flatEase, flatEase);
                            $.writeln("Устанавливаем flatEase для правого ключа: " + flatEase.length + " элементов.");
                        } catch (e) {
                            $.writeln("Ошибка при установке temporal ease для правого ключа: " + e.toString());
                        }
                    }

                    // Удаляем исходный ключ
                    deleteKey(property, keyIndex);
                    $.writeln("Удаляем исходный ключ: индекс = " + keyIndex);
                }
                else if (hasLeft) {
                    var targetKeyTime = property.keyTime(leftKeyIndex);
                    moveKey(property, keyIndex, targetKeyTime);
                }
                else if (hasRight) {
                    var targetKeyTime = property.keyTime(rightKeyIndex);
                    moveKey(property, keyIndex, targetKeyTime);
                }
                else {
                    // Нет соседних ключей для разделения
                    $.writeln("Ключ на " + keyTime.toFixed(2) + " секунд не имеет соседних ключей для разделения.");
                }
            }
        }

        alert("Операция завершена.");
    });

    app.endUndoGroup();
}