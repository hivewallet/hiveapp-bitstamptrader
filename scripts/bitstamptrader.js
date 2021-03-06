var bitstamp = new Bitstamp();
// Override for Hive-specific call due to lack of CORS
Object.getPrototypeOf(bitstamp).requestFunction = function(xhrParams) {
  var url = xhrParams.url;
  delete xhrParams.url;
  bitcoin.makeRequest(url, xhrParams);
}
var refreshsecs = 15;
var systemInfo = {};

numeral.language('hive-eu', {
    delimiters: {
        thousands: ' ',
        decimal: ','
    },
    abbreviations: {
        thousand: 'k',
        million: 'mm',
        billion: 'b',
        trillion: 't'
    },
    ordinal : function (number) {
        return '--';
    },
    currency: {
        symbol: '$'
    }
});

function format_number( number, format ){
  if (systemInfo.decimalSeparator === ',') {
    numeral.language('hive-eu');
  }

  value = numeral(number);
  result = value.format(format)

  // Zero is zero
  // numeral.zeroFormat('0');

  return result;
}

function format_usd(number) {
  return format_number(number, '$0,0.00')
}

function format_btc_respect_user_denomination(number) {
  return bitcoin.userStringForSatoshi(bitcoin.BTC_IN_SATOSHI * number)
}

function format_volume(number) {
  return format_number(number, '0,0')
}

function listUnconfirmedBitcoinTransactions() {
  params = bitstamp.submitRequest(bitstamp.methods.unconfirmedbtc, function(response){
    $('#pending_transfers option').each(function(index, option) {
      if ($(option).hasClass('pending_deposit')) {
        $(option).remove();
      }
    });

    if ('data' in response) {
      if (response.data.length > 0) {
        $.each(response.data, function(index, value) {
          msg = value.amount + ' BTC has ' + value.confirmations + ' confirmations';
          $('#pending_transfers').append('<option class="pending_deposit">' + msg + '</option>');
        });
      } else {
          $('#pending_transfers').append('<option class="pending_deposit">No pending deposits</option>');
        }
    } else {
      errormsg = (response.error || 'Unknown error');
      console.log(errormsg);
      $('#pending_transfers').append('<option class="pending_deposit">Could not load deposits: ' + errormsg + '</option>');
    }
  });
}


function listPendingWithdrawalRequests() {
  params = bitstamp.submitRequest(bitstamp.methods.withdrawalrequests, function(response){
    $('#pending_transfers option').each(function(index, option) {
      if ($(option).hasClass('pending_withdrawal')) {
        $(option).remove();
      }
    });

    if ('data' in response) {
      if (response.data.length > 0) {
        $.each(response.data, function(index, value) {
          typedesc = 'Unknown';
          if (value.type == 0) {
            typedesc = 'SEPA';
          } else if (value.type == 1) {
            typedesc = 'bitcoin';
          } else if (value.type == 2) {
            typedesc = 'WIRE transfer';
          } else if (value.type == 3) {
            typedesc = 'bitstamp code';
          } else if (value.type == 4) {
            typedesc = 'bitstamp code';
          } else if (value.type == 5) {
            typedesc = 'Mt.Gox code';
          }

          statusdesc = 'unknown';
          if (value.type == 0) {
            statusdesc = 'open';
          } else if (value.type == 1) {
            statusdesc = 'in process';
          } else if (value.type == 2) {
            statusdesc = 'finished';
          } else if (value.type == 3) {
            statusdesc = 'canceled';
          } else if (value.type == 4) {
            statusdesc = 'failed';
          }

          msg = value.amount.toString() + ' via ' + typedesc + ' at ' + value.datetime + ' is ' + statusdesc;
          $('#pending_transfers').append('<option class="pending_withdrawal">' + msg + '</option>');
        });
        } else {
          $('#pending_transfers').append('<option class="pending_withdrawal">No pending withdrawals</option>');
        }
    } else {
      errormsg = (response.error || 'Unknown error');
      console.log(errormsg);
      $('#pending_transfers').append('<option class="pending_withdrawal">Could not load withdrawals: ' + errormsg + '</option>');
    }
  });
}

function bitcoinWithdrawl(amount) {
  $('#btcwithdrawal').prop('disabled', true);
  bitcoin.getUserInfo(function(info){
    var user_address = info.address;
    var additionalParams = {'amount': btcAmountFromInput(amount), 'address': user_address}
    params = bitstamp.submitRequest(bitstamp.methods.btcwithdrawal, additionalParams, function(response){
      $('#btcwithdrawal').prop('disabled', false);
      handleResponse(response, function(response){
        refreshUserTransactions();
        listPendingWithdrawalRequests();
      })
    });
  });
}

function btcAmountFromInput(amount) {
  return bitcoin.satoshiFromUserString(amount) / bitcoin.BTC_IN_SATOSHI
}

function orderBuy(amount, price) {
  $('#orderbuy').prop('disabled', true);
  params = bitstamp.submitRequest(bitstamp.methods.orderbuy, {'amount': btcAmountFromInput(amount), 'price': price }, completeTrade);
}

function orderSell(amount, price) {
  $('#ordersell').prop('disabled', true);
  params = bitstamp.submitRequest(bitstamp.methods.ordersell, {'amount': btcAmountFromInput(amount), 'price': price }, completeTrade);
}

function completeTrade(response) {
  $('#orderbuy').prop('disabled', false);
  $('#ordersell').prop('disabled', false);

  handleResponse(response, function(response){
    $('#trade_amount').val('');
    $('#trade_price').val('');
    refreshOpenOrders();
    refreshBalance();
    //refreshUserTransactions();
  })
}

function getBitcoinDepositAddress() {
  $('#btcdeposit').prop('disabled', true);
  params = bitstamp.submitRequest(bitstamp.methods.btcdepositaddress, function(response){
    $('#btcdeposit').prop('disabled', false);
    handleResponse(response, function(response){
      var satoshiValue = bitcoin.satoshiFromUserString($('#transferamount').val())
      bitcoin.sendMoney(response.data, satoshiValue, function(success, transactionId){
        if (success === true) {
          listUnconfirmedBitcoinTransactions(); // this is unlikely to show anything
        }
      });
    })
  });
}

function refreshUserTransactions() {
  bitstamp.submitRequest(bitstamp.methods.usertransactions, function(response){
      // Clear transactions list
      $('#usertransactionlist option').each(function(index, option) {$(option).remove();});

      if ('data' in response) {
        // Build transactions
        $.each(response.data, function(index, value) {
          typedesc = 'Other';
          if (value.type == 0) {
            typedesc = 'Deposit';
          } else if (value.type == 1) {
            typedesc = 'Withdrawal';
          } else if (value.type == 2) {
            typedesc = 'Market trade';
          }
          msg = typedesc + ' at ' + value.datetime;
          $('#usertransactionlist').append('<option>' + msg + '</option>');
        });

        // Exception for empty transaction list
        if ($('#usertransactionlist option').size() < 1) {
          $('#usertransactionlist').append('<option>No transactions</option>');
        }
      } else {
        errormsg = response.error || 'Unknown error';
        $('#usertransactionlist').append('<option>Could not load transactions: ' + errormsg + '</option>');
      }
    },
    {} // Could be used for pagination in the future
  );
}

function doLogout() {
  // this should have the result of expiring all cookies
  storeLoginDetails(bitstamp, -1);
  bitstamp = null;
  location.reload(false);
}

function refreshOpenOrders() {
  params = bitstamp.submitRequest(bitstamp.methods.openorders, function(response){
    // Clear transactions list
    $('#user_openorders option').each(function(index, option) {$(option).remove();});

    if ('data' in response) {
      $('#btn_cancelorder').prop('disabled', false);
      // Build transactions
      $.each(response.data, function(index, value) {
        typedesc = 'Other';
        if (value.type == 0) {
          typedesc = 'Buy ';
        } else if (value.type == 1) {
          typedesc = 'Sell ';
        }
        msg = typedesc + format_btc_respect_user_denomination(value.amount) + ' ' + systemInfo.preferredBitcoinFormat + ' at ' + value.price + ' USD';
        $('#user_openorders').append('<option value="' + value.id + '">' + msg + '</option>');
      });

      // Exception for empty transaction list
      if ($('#user_openorders option').size() < 1) {
        $('#user_openorders').append('<option value="">No open orders</option>');
        $('#btn_cancelorder').prop('disabled', true);
      }
    } else {
      errormsg = (response.error || 'Unknown error');
      $('#user_openorders').append('<option value="">Could not load orders: ' + errormsg + '</option>');
      $('#btn_cancelorder').prop('disabled', true);
    }
  });
}

function cancelOrders() {
  $('#user_openorders option:selected').each(function(index, option){
    if (parseInt(option.value) > 0) {
      console.log('Canceling order with id ' + option.value.toString());

      params = bitstamp.submitRequest(bitstamp.methods.cancelorder, {id: option.value}, function(response) {
        handleResponse(response, function(response){
          refreshOpenOrders();
          refreshBalance();
          //refreshUserTransactions();
        })
      });
    }
  });
}

function refreshBalance(callback) {
  params = bitstamp.submitRequest(bitstamp.methods.balance, function(response) {
      $('.data_client_id').text(bitstamp.auth.client_id.toString());
      $('.data_user_fee').text(format_number(response.data.fee / 100, '0.00%'));

      $('.data_balance_btc').text(format_btc_respect_user_denomination(response.data.btc_balance));
      $('.data_available_btc').text(format_btc_respect_user_denomination(response.data.btc_available));
      $('.data_reserved_btc').text(format_btc_respect_user_denomination(response.data.btc_reserved));
      $('.unit').text(systemInfo.preferredBitcoinFormat);

      $('.data_balance_usd').text(format_usd(response.data.usd_balance));
      $('.data_available_usd').text(format_usd(response.data.usd_available));
      $('.data_reserved_usd').text(format_usd(response.data.usd_reserved));

      callback(response);
  });
}

function doLogin(clientid, apikey, apisecret) {
  bitstamp = new Bitstamp(clientid, apikey, apisecret);

  refreshBalance(function(response) {
    $('#loginmessage').hide();
    handleResponse(response, function(response){
      storeLoginDetails(bitstamp);
      $('#panel_login').hide();
      $('#panel_trade').show();
      window.setTimeout(refreshOpenOrders, 600);
      window.setTimeout(refreshUserTransactions, 1000);
      window.setTimeout(listPendingWithdrawalRequests, 200);
      window.setTimeout(listUnconfirmedBitcoinTransactions, 400);
    }, function(response){
      $('#panel_login').show();
      $('#panel_trade').hide();
    })
  });
}

function storeLoginDetails(bitstamp, years) {
  years = years || 1;

  var d = new Date();
  d.setFullYear(d.getFullYear() + years)
  document.cookie = 'clientid='+ bitstamp.auth.client_id + '; expires=' + d.toGMTString();;
  document.cookie = 'apikey='+ bitstamp.auth.api_key + '; expires=' + d.toGMTString();
  document.cookie = 'apisecret='+ bitstamp.auth.api_secret + '; expires=' + d.toGMTString();
}

function getCookieValue(keyname) {
    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(keyname).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
}

function checkLogin() {
  clientid = getCookieValue('clientid');
  apikey = getCookieValue('apikey');
  apisecret = getCookieValue('apisecret');

  if (clientid && apikey && apisecret) {
    console.log('Found login details for ' + clientid);
    $('#login_form').hide();
    $('#loginmessage').show();
    doLogin(clientid, apikey, apisecret);
  } else {
    console.log('Did not find login details in cookie');
  }
}

function getTicker(response) {
  params = bitstamp.submitRequest(bitstamp.methods.ticker, function(response){
    handleResponse(response, function(response){
      $('.data_ticker_last').text(format_usd(response.data.last));
      $('.data_ticker_high').text(format_usd(response.data.high));
      $('.data_ticker_low').text(format_usd(response.data.low));
      $('.data_ticker_volume').text(format_volume(response.data.volume));
      // $('.data_ticker_bid').text(format_usd(response.data.bid));
      // $('.data_ticker_ask').text(format_usd(response.data.ask));
    })
  });
}

function handleResponse(response, successCallback, errorCallback) {
  if ('data' in response) {
    hideError()
    successCallback(response)
  } else {
    $('.alert').text(response.error || "Unknown error")
    $('.alert').show()
    if(errorCallback) errorCallback(response)
  }
}

function hideError(){
  $('.alert').text('')
  $('.alert').hide()
}
