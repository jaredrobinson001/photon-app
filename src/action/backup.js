import {HDSegwitBech32Wallet, KeyBackup} from '@photon-sdk/photon-lib';

import store from '../store';
import * as nav from './nav';
import * as alert from './alert';
import {saveToDisk} from './wallet';

//
// Init
//

export function init() {
  KeyBackup.init({keyServerURI: store.config.keyServer});
}

export async function checkBackup() {
  store.backupExists = await KeyBackup.checkForExistingBackup();
  return store.backupExists;
}

//
// Pin Set screen
//

export function initBackup() {
  store.backup.pin = '';
  store.backup.pinVerify = '';
  nav.reset('Backup');
}

export function setPin(pin) {
  store.backup.pin = pin;
}

export async function validateNewPin() {
  try {
    _validateNewPin();
    nav.goTo('PinVerify');
  } catch (err) {
    initBackup();
    alert.error({err});
  }
}

function _validateNewPin() {
  const {pin} = store.backup;
  if (!pin || pin.length < 6) {
    throw new Error('PIN must be at least 6 digits!');
  }
  return pin;
}

//
// Pin Check screen
//

export function setPinVerify(pin) {
  store.backup.pinVerify = pin;
}

export async function validatePinVerify() {
  try {
    const pin = _validatePinVerify();
    nav.reset('Main');
    await _generateWalletAndBackup(pin);
  } catch (err) {
    initBackup();
    alert.error({err});
  }
}

function _validatePinVerify() {
  const {pin, pinVerify} = store.backup;
  if (pin !== pinVerify) {
    throw new Error("PINs don't match!");
  }
  return pin;
}

async function _generateWalletAndBackup(pin) {
  // generate new wallet
  const wallet = new HDSegwitBech32Wallet();
  await wallet.generate();
  const mnemonic = await wallet.getSecret();
  // cloud backup of encrypted seed
  const data = {mnemonic};
  await KeyBackup.createBackup({data, pin});
  await saveToDisk(wallet);
}

//
// Restore screen
//

export function initRestore() {
  store.backup.pin = '';
  nav.reset('Restore');
}

export async function validatePin() {
  try {
    nav.reset('Main');
    await _verifyPinAndRestore();
  } catch (err) {
    initRestore();
    alert.error({message: 'Invalid PIN', err});
  }
}

async function _verifyPinAndRestore() {
  const {pin} = store.backup;
  // fetch encryption key and decrypt cloud backup
  const {mnemonic} = await KeyBackup.restoreBackup({pin});
  // restore wallet from seed
  const wallet = new HDSegwitBech32Wallet();
  wallet.setSecret(mnemonic);
  if (!wallet.validateMnemonic()) {
    throw Error('Cannot validate mnemonic');
  }
  await saveToDisk(wallet);
}
