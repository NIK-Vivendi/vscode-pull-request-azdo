import * as vscode from 'vscode';
import type { PullRequestModel } from '../azdo/pullRequestModel';
import type { RepositoriesManager } from '../azdo/repositoriesManager';
import { DescriptionNode } from '../view/treeNodes/descriptionNode';

export function findFolderManager(reposManager: RepositoriesManager, pr?: DescriptionNode | PullRequestModel) {
	// If called from PR list, get the PR model without switching
	if (pr) {
		let targetPR: PullRequestModel;
		if (pr instanceof DescriptionNode) {
			targetPR = pr.pullRequestModel;
		} else {
			targetPR = pr;
		}

		return {
			folderManager: reposManager.getManagerForPullRequestModel(targetPR),
			targetPR,
		};
	} else {
		// Called from review mode
		const activeReviewFolderManager = reposManager.folderManagers.find(rm => rm.activePullRequest);
		if (!activeReviewFolderManager) {
			vscode.window.showErrorMessage('No active pull request found.');
			return;
		}

		return {
			targetPR: activeReviewFolderManager.activePullRequest!,
			folderManager: activeReviewFolderManager,
		};
	}
}
