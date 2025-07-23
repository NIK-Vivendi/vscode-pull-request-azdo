import * as vscode from 'vscode';
import { SETTINGS_NAMESPACE } from '../constants';

const enum LogLevel {
	Info,
	Debug,
	Off,
}

const LOG_LEVEL_SETTING = 'logLevel';

class Log {
	private _outputChannel: vscode.OutputChannel;
	private _logLevel: LogLevel;
	private _disposable: vscode.Disposable;

	constructor() {
		this._outputChannel = vscode.window.createOutputChannel('AzDO Pull Request');
		this._disposable = vscode.workspace.onDidChangeConfiguration(() => {
			this.getLogLevel();
		});
		this.getLogLevel();
	}

	public appendLine(message: string, component?: string) {
		if (this._logLevel === LogLevel.Off) {
			return;
		}

		const timeStamp = this._logLevel === LogLevel.Debug ? `${new Date().getTime() / 1000}s` : '';

		const info = component ? `${component}> ${message}` : `${message}`;

		switch (this._logLevel) {
			case LogLevel.Debug:
				this._outputChannel.appendLine(`[Debug ${timeStamp}] ${info}`);
				return;
			case LogLevel.Info:
			default:
				this._outputChannel.appendLine(`[Info ${timeStamp}] ${info}`);
				return;
		}
	}

	public debug(message: string, component: string) {
		if (this._logLevel === LogLevel.Debug) {
			this.appendLine(message, component);
		}
	}

	public dispose() {
		if (this._disposable) {
			this._disposable.dispose();
		}
	}

	private getLogLevel() {
		const logLevel = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string>(LOG_LEVEL_SETTING);
		switch (logLevel) {
			case 'debug':
				this._logLevel = LogLevel.Debug;
				break;
			case 'off':
				this._logLevel = LogLevel.Off;
				break;
			case 'info':
			default:
				this._logLevel = LogLevel.Info;
				break;
		}
	}
}

const Logger = new Log();
export default Logger;
