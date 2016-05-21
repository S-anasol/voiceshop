/**
 * Created by buuni on 21.05.16.
 */

/**
 * Created by buuni on 08.05.2016.
 */

var UID, stepsCallback;

function VoiceApi() {

}

VoiceApi.prototype = {
    URL: 'http://www.voicebots.ru',
    //URL: 'http://107.178.215.251',
    pollingInterval: 5000,
    stepsCallback: {},
    token: null,
    settings: {},
    uid: null,

    constructor: VoiceApi,

    /**
     * Совершает звонок с дополнительными параметрами на номер, указанный в объекте.
     * @param $settings
     */
    call: function($settings) {
        var _this = this;
        stepsCallback = $settings.steps_callback;
        this.sendRequest({
            url: this.pathFor('/makeCall(' + [_this.token, $settings.callee_phone].join(',')  + ').json'),
            success: this.pollingStart,
            processData: false,
            data: JSON.stringify({ basket_list: "2 позиции на сумму 5900 рублей" }),
        });
    },

    /**
     * Начало пинга на сервер.
     * @param response
     * @returns {*}
     */
    pollingStart: function(response) {
        if(response.uid == null) {
            return this.error(100);
        }
        var _this = this;
        UID = response.uid;
        setTimeout(polling, _this.pollingInterval);
    },

    send: function($object) {
        this.sendRequest({
            url: this.pathFor('/setStepResult(' + this.uid + ').json'),
            success: $object.success,
            processData: false,
            data: JSON.stringify({
                step: $object.step,
                result: $object.result,
            }),
        });
    },

    /**
     * Завершает пинг, если пришла какая-то ошибка.
     * @param code
     * @returns {boolean}
     */
    error: function(code) {
        switch (code) {
            case 100:
                console.log('CONNECT_ERROR: token is invalid');
                break;
            default:
                console.log('ERROR: system has not running');
        }

        return false;
    },

    /**
     * Посылает ajax запрос на удаленный сервер.
     * @param $object
     */
    sendRequest: function($object) {
        var defaultObject = {
            async: true,
            method: 'POST',
            url: '',
            dataType: 'json',
            data: {},
            processData: false,
            success: function(response) { return response },
            error: function(xhr, str) { return xhr },
            always: function() {
                //$.unblockUI();
            }
        }

        for (var attrname in $object) {
            defaultObject[attrname] = $object[attrname];
        }

        var success = defaultObject.success;
        var error = defaultObject.error;

        //$.blockUI({
        //    message: '<img src="' + this.pathFor('/assets/images/loading.svg') + '">',
        //    css: ''
        //});

        $.ajax({
            async: defaultObject.async,
            type: defaultObject.method,
            url: defaultObject.url,
            dataType: defaultObject.type,
            data: defaultObject.data,
            success: success,
            error: error
        }).always(defaultObject.always);
    },

    /**
     * Возвращает полный путь до метода к удаленному серверу.
     * @param path
     * @returns {string}
     */
    pathFor: function(path) {
        return this.URL + path;
    },

    setParams: function(token, settings) {
        this.token = token;
        this.settings = settings;
    },

};


var API = (function () {
    var instance;

    function createInstance() {
        var object = new VoiceApi();
        return object;
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();

var CURRENT_STEP = 0;

/**
 * Основная функция пинга сервера. Получаем статусы, разбираем их и выводим шаги.
 * @param response
 */
var polling = function() {
    var _this = API.getInstance();
    console.log('polling');
    console.log(UID);
    _this.sendRequest({
        url: _this.pathFor('/getState(' + UID + ').json'),
        success: function(response) {
            console.log(response);
            if(typeof response.step != 'undefined') {
                if(CURRENT_STEP != response.step) {
                    CURRENT_STEP = response.step;
                    console.log('set new step');
                    console.log('step-' + response.step);
                    if (stepsCallback['step-' + response.step]) {
                        console.log('start callback');
                        stepsCallback['step-' + response.step](response);
                    }
                }
            }

            setTimeout(polling, _this.pollingInterval);
        }
    });
};

$(document).ready(function() {
    // Custom настройки для создания соеденения с сервером VoiceShop.
    var APIV = API.getInstance();
    APIV.setParams('ABCDEF', {});

    $('#tel').mask('79999999999');

    $('#send-phone').click(function() {
        APIV.call({
            callee_phone: $('#tel').val(),
            steps_callback: {
                'step-2': visibleRelatedProducts,
                'step-5': hiddenRelatedProducts,
                'step-6': visibleMap,
            }
        });
    });

    function visibleRelatedProducts(response) {
        $('#voice-step-2').removeClass('hidden');

        $('#step-2-send').click(function(e) {
            e.preventDefault();
            var _this = this;

            $(this).addClass('load');

            //APIV.send({
            //    step: 2,
            //    result: true,
            //    success: function(response) {
            //        $(_this).removeClass('load');
            //    }
            //});
        });
    }

    function hiddenRelatedProducts(response) {
        $('#voice-step-2').addClass('hidden');
        $('#voice-step-5').removeClass('hidden');
    }

    function visibleMap(response) {
        $('#voice-step-6').removeClass('hidden');
        $('#voice-step-5').addClass('hidden');

        ('#send-step-6').click(function(e) {
            e.preventDefault();
            APIV.send({
                step: 6,
                result: true,
                success: function(response) {
                    $('#voice-step-6').addClass('hidden');
                    $('#voice-step-7').removeClass('hidden');
                }
            })
        });
    }
});