'use strict';

var _ = require('lodash');

function init (client, plugins, serverSettings, $) {

  var storage = $.localStorage;
  var settings = require('../settings')();

  function loadForm ( ) {
    var utils = require('../utils')(settings);
    var language = require('../language')();
    language.set(settings.language);
    var translate = language.translate;

    function appendThresholdValue(threshold) {
      return settings.alarmTypes.indexOf('simple') === -1 ? '' : ' (' + utils.scaleMgdl(threshold) + ')';
    }

    if (settings.units === 'mmol') {
      $('#mmol-browser').prop('checked', true);
    } else {
      $('#mgdl-browser').prop('checked', true);
    }
    $('#alarm-urgenthigh-browser').prop('checked', settings.alarmUrgentHigh).next().text(translate('Urgent High Alarm') + appendThresholdValue(settings.thresholds.bgHigh));
    $('#alarm-high-browser').prop('checked', settings.alarmHigh).next().text(translate('High Alarm') + appendThresholdValue(settings.thresholds.bgTargetTop));
    $('#alarm-low-browser').prop('checked', settings.alarmLow).next().text(translate('Low Alarm') + appendThresholdValue(settings.thresholds.bgTargetBottom));
    $('#alarm-urgentlow-browser').prop('checked', settings.alarmUrgentLow).next().text(translate('Urgent Low Alarm') + appendThresholdValue(settings.thresholds.bgLow));
    $('#alarm-timeagowarn-browser').prop('checked', settings.alarmTimeagoWarn);
    $('#alarm-timeagowarnmins-browser').val(settings.alarmTimeagoWarnMins);
    $('#alarm-timeagourgent-browser').prop('checked', settings.alarmTimeagoUrgent);
    $('#alarm-timeagourgentmins-browser').val(settings.alarmTimeagoUrgentMins);

    $('#nightmode-browser').prop('checked', settings.nightMode);

    if (settings.isEnabled('rawbg')) {
      $('#show-rawbg-option').show();
      $('#show-rawbg-' + settings.showRawbg).prop('checked', true);
    } else {
      $('#show-rawbg-option').hide();
    }

    $('h1.customTitle').text(settings.customTitle);
    $('input#customTitle').prop('value', settings.customTitle);

    if (settings.theme === 'colors') {
      $('#theme-colors-browser').prop('checked', true);
    } else {
      $('#theme-default-browser').prop('checked', true);
    }

    var langSelect = $('#language');

    _.each(language.languages, function eachLanguage(lang) {
      langSelect.append('<option value="' + lang.code+ '">' + lang.language + '</option>');
    });

    langSelect.val(settings.language);

    $('#scaleY').val(settings.scaleY);

    $('#basalrender').val(settings.extendedSettings.basal ? settings.extendedSettings.basal.render : 'none');

    if (settings.timeFormat === 24) {
      $('#24-browser').prop('checked', true);
    } else {
      $('#12-browser').prop('checked', true);
    }

    var showPluginsSettings = $('#show-plugins');
    var hasPluginsToShow = false;
    plugins.eachEnabledPlugin(function each(plugin) {
      if (plugins.specialPlugins.indexOf(plugin.name) > -1) {
        //ignore these, they are always on for now
      } else {
        var id = 'plugin-' + plugin.name;
        var dd = $('<dd><input type="checkbox" id="' + id + '" value="' + plugin.name + '"/><label for="' + id + '">' + translate(plugin.label || plugin.name) + '</label></dd>');
        showPluginsSettings.append(dd);
        dd.find('input').prop('checked', settings.showPlugins.indexOf(plugin.name) > -1);
        hasPluginsToShow = true;
      }
    });

    showPluginsSettings.toggle(hasPluginsToShow);

    $('#editprofilelink').toggle(settings.isEnabled(['iob', 'cob', 'bwp', 'basal']));

  }

  function wireForm ( ) {
    $('#useDefaults').click(function(event) {
      settings.eachSetting(function clearEachSetting (name) {
        storage.remove(name);
      });
      storage.remove('basalrender');
      event.preventDefault();
      client.browserUtils.reload();
    });

    $('#save').click(function(event) {
      function checkedPluginNames() {
        var checkedPlugins = [];
        $('#show-plugins input:checked').each(function eachPluginCheckbox(index, checkbox) {
          checkedPlugins.push($(checkbox).val());
        });
        return checkedPlugins.join(' ');
      }

      function storeInBrowser(data) {
        for (var k in data) {
          if (data.hasOwnProperty(k)) {
            storage.set(k, data[k]);
          }
        }
      }

      storeInBrowser({
        units: $('input:radio[name=units-browser]:checked').val(),
        alarmUrgentHigh: $('#alarm-urgenthigh-browser').prop('checked'),
        alarmHigh: $('#alarm-high-browser').prop('checked'),
        alarmLow: $('#alarm-low-browser').prop('checked'),
        alarmUrgentLow: $('#alarm-urgentlow-browser').prop('checked'),
        alarmTimeagoWarn: $('#alarm-timeagowarn-browser').prop('checked'),
        alarmTimeagoWarnMins: parseInt($('#alarm-timeagowarnmins-browser').val()) || 15,
        alarmTimeagoUrgent: $('#alarm-timeagourgent-browser').prop('checked'),
        alarmTimeagoUrgentMins: parseInt($('#alarm-timeagourgentmins-browser').val()) || 30,
        nightMode: $('#nightmode-browser').prop('checked'),
        showRawbg: $('input:radio[name=show-rawbg]:checked').val(),
        customTitle: $('input#customTitle').prop('value'),
        theme: $('input:radio[name=theme-browser]:checked').val(),
        timeFormat: parseInt($('input:radio[name=timeformat-browser]:checked').val()),
        language: $('#language').val(),
        scaleY: $('#scaleY').val(),
        basalrender: $('#basalrender').val(),
        showPlugins: checkedPluginNames()
      });

      event.preventDefault();
      client.browserUtils.reload();
    });
  }

  function showLocalstorageError ( ) {
    var msg = '<b>Settings are disabled.</b><br /><br />Please enable cookies so you may customize your Nightscout site.';
    $('.browserSettings').html('<legend>Settings</legend>'+msg+'');
    $('#save').hide();
  }

  settings.extendedSettings = serverSettings.extendedSettings;

  try {
    settings.eachSetting(function setEach (name) {
      var stored = storage.get(name);
      return stored !== undefined && stored !== null ? stored : serverSettings.settings[name];
    });

    if (!settings.extendedSettings.basal) {
      settings.extendedSettings.basal = {};
    }

    var stored = storage.get('basalrender');
    settings.extendedSettings.basal.render = stored !== null ? stored : settings.extendedSettings.basal.render;
  } catch(err) {
    console.error(err);
    showLocalstorageError();
  }

  settings.thresholds = serverSettings.settings.thresholds;
  settings.enable = serverSettings.settings.enable;

  if (settings.enable.indexOf('ar2') < 0) {
    settings.enable += ' ar2';
  }

  plugins.init(settings);

  loadForm();
  wireForm();

  return settings;
}


module.exports = init;