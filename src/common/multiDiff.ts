import * as vscode from 'vscode';
import type { Repository } from '../api/api';
import type { PullRequestModel } from '../azdo/pullRequestModel';
import type { RepositoriesManager } from '../azdo/repositoriesManager';
import type { ReviewManager } from '../view/reviewManager';
import { DescriptionNode } from '../view/treeNodes/descriptionNode';
import { GitChangeType } from './file';
import { asImageDataURI, EMPTY_IMAGE_URI, toPRUriAzdo } from './uri';

export function getPullRequestTitle(reposManager: RepositoriesManager, pr?: DescriptionNode | PullRequestModel) {
	if (!pr) {
		return 'Pull Request';
	}

	let targetPR: PullRequestModel;
	if (pr instanceof DescriptionNode) {
		targetPR = pr.pullRequestModel;
	} else {
		targetPR = pr;
	}

	targetPR ??= reposManager.folderManagers.find(fm => fm.activePullRequest)?.activePullRequest;

	return targetPR?.item.title ?? 'Pull Request';
}

export type MultiDiffViewFileInput = {
	label: vscode.Uri;
	original?: vscode.Uri;
	modified?: vscode.Uri;
};

export async function openPullRequestDiffView(reviewManagers: ReviewManager[]) {
	const activeReviewManager = reviewManagers.find(rm => rm.hasActiveReview());
	if (!activeReviewManager) {
		vscode.window.showErrorMessage('No active pull request found.');
		return;
	}

	// Get changed files from review manager
	const changedFiles = activeReviewManager.localFileChanges;
	if (!changedFiles || changedFiles.length === 0) {
		vscode.window.showInformationMessage('No changed files found in the current pull request.');
		return;
	}
	// Prepare resource list for multi-file diff editor
	const resourceList: MultiDiffViewFileInput[] = [];

	for (const fileChange of changedFiles) {
		const parentFilePath = fileChange.parentFilePath;
		const filePath = fileChange.filePath;

		// Handle image files if needed
		let parentURI = parentFilePath;
		let headURI = filePath;

		const newURIs = await generateImageDataUris(activeReviewManager.repository, parentURI, headURI, fileChange.status);
		parentURI = newURIs.originalUri;
		headURI = newURIs.modifiedUri;

		resourceList.push({
			label: filePath,
			original: parentURI,
			modified: headURI,
		});
	}

	return resourceList;
}

export async function getPullRequestReviewDiffViewArgs(
	reposManager: RepositoriesManager,
	pr: DescriptionNode | PullRequestModel,
) {
	let targetPR: PullRequestModel;
	if (pr instanceof DescriptionNode) {
		targetPR = pr.pullRequestModel;
	} else {
		targetPR = pr;
	}

	const folderManager = reposManager.getManagerForPullRequestModel(targetPR);

	if (!folderManager) {
		vscode.window.showErrorMessage('Could not find folder manager for pull request.');
		return;
	}
	// Get file changes directly from the PR model without checking out
	const fileChanges = await targetPR.getFileDiffChanges(folderManager.repository);

	if (!fileChanges || fileChanges.length === 0) {
		vscode.window.showInformationMessage('No changed files found in the current pull request.');
		return;
	}

	// Prepare resource list for multi-file diff editor
	const resourceList: MultiDiffViewFileInput[] = [];

	for (const change of fileChanges) {
		const fileName = change.fileName;
		// if (change.status === GitChangeType.DELETE) {
		// 	fileName = change.previousFileName!;
		// }

		const filePath = folderManager.repository.rootUri.with({ path: fileName });
		const parentFileName = change.previousFileName || change.fileName;
		const parentFilePath = folderManager.repository.rootUri.with({ path: parentFileName });

		// Create URIs for the diff using the review scheme
		const headCommit = targetPR.head.sha;

		// For the base (original) version
		let originalUri: vscode.Uri | undefined;
		if (change.status !== GitChangeType.ADD) {
			originalUri = toPRUriAzdo(
				parentFilePath,
				targetPR,
				change.baseCommit,
				headCommit,
				parentFileName,
				true,
				change.status,
			);
		}

		// For the modified (head) version
		let modifiedUri: vscode.Uri | undefined;
		if (change.status !== GitChangeType.DELETE) {
			modifiedUri = toPRUriAzdo(filePath, targetPR, change.baseCommit, headCommit, fileName, false, change.status);
		}

		({ originalUri, modifiedUri } = await generateImageDataUris(
			folderManager.repository,
			originalUri,
			modifiedUri,
			change.status,
		));

		resourceList.push({
			label: filePath,
			original: originalUri,
			modified: modifiedUri,
		});
	}

	return resourceList;
}

async function generateImageDataUris(
	repository: Repository,
	originalUri: vscode.Uri,
	modifiedUri: vscode.Uri,
	status: GitChangeType,
) {
	if (originalUri) {
		originalUri = (await asImageDataURI(originalUri, repository)) || originalUri;
	}

	if (modifiedUri) {
		modifiedUri = (await asImageDataURI(modifiedUri, repository)) || modifiedUri;
	}

	if (originalUri?.scheme === 'data' || modifiedUri?.scheme === 'data') {
		if (status === GitChangeType.ADD) {
			originalUri = EMPTY_IMAGE_URI;
		}
		if (status === GitChangeType.DELETE) {
			modifiedUri = EMPTY_IMAGE_URI;
		}
	}

	return { originalUri, modifiedUri };
}
