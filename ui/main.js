import "./import_jquery";
import {emit, listen} from "@tauri-apps/api/event";
import {SVGManager} from "./svg_manager";
import hljs from "highlight.js";
import Resizable from "resizable";

// This doesn't work if it isn't a separate function for some reason...
function togglerClick() {
    this.parentElement.querySelector(".nested").classList.toggle("active-tree");
    this.querySelector(".fa-caret-down").classList.toggle("rotated-caret");
}

class Main {
    constructor() {
        this.processCount = 0;
        this.svgManager = new SVGManager();
        this.generalInfo = {};
    }

    run() {
        const self = this;
        $('#contextMenu').hide();
        self.showCommitControls();

        $('#mainSpinner').hide();

        self.setupTreeViews();

        // Setup resizable columns.
        const resizableColumns = document.querySelectorAll(".resizable-column");
        resizableColumns.forEach((resizableColumn) => {
            const r = new Resizable(resizableColumn, {
                within: 'parent',
                handles: 'e',
                threshold: 10,
                draggable: false,
            });
            if (resizableColumn.classList.contains('resizable-column-file-paths')) {
                r.on('resize', function() {
                    self.truncateFilePathText();
                });
            }
        });

        const resizableRows = document.querySelectorAll(".resizable-row");
        resizableRows.forEach((resizableRow) => {
            const r = new Resizable(resizableRow, {
                within: 'parent',
                handles: 's',
                threshold: 10,
                draggable: false,
            });
            if (resizableRow.classList.contains('resizable-row-graph')) {
                r.on('resize', function() {
                    self.svgManager.setVisibleCommitsOnResize();
                });
            }
        });

        $(window).click(() => {
            $('#contextMenu').hide();
        });

        $(window).resize(() => {
            self.truncateFilePathText();
            self.svgManager.setVisibleCommitsOnResize();
        });

        listen("start-process", ev => {
            self.addProcessCount();
        }).then();

        listen("end-process", ev => {
            self.removeProcessCount();
        }).then();

        listen("commit-info", ev => {
            self.showCommitInfo(ev.payload);
        }).then();

        listen("update_all", ev => {
            self.updateAll(ev.payload);
            self.removeProcessCount();
        }).then();

        listen("update_changes", ev => {
            self.updateFilesChangedInfo(ev.payload);
        }).then();

        listen("get-credentials", ev => {
            $('#credentialsModal').modal('show');
        }).then();

        listen("show-preferences", ev => {
            const $limitCommitsCheckBox = $('#limitCommitsCheckBox'),
                $commitCountNumber = $('#commitCountNumber');
            $limitCommitsCheckBox.prop('checked', ev.payload['limit_commits']);
            $commitCountNumber.val(ev.payload['commit_count']);
            if ($limitCommitsCheckBox.is(':checked')) {
                $commitCountNumber.prop('disabled', false);
            } else {
                $commitCountNumber.prop('disabled', true);
            }
            $('#preferencesModal').modal('show');
        }).then();

        listen("show-file-lines", ev => {
            self.showFileDiff(ev.payload);
        }).then();

        listen("error", ev => {
            // TODO: Maybe make a modal for errors instead?
            self.removeProcessCount();
            alert(ev.payload);
        }).then();

        $('#commits-tab').click(() => {
            self.svgManager.setVisibleCommits();
        });

        $('#changes-tab').click(() => {
            self.truncateFilePathText();
        });

        $('#limitCommitsCheckBox').change(() => {
            if ($('#limitCommitsCheckBox').is(':checked')) {
                $('#commitCountNumber').prop('disabled', false);
            } else {
                $('#commitCountNumber').prop('disabled', true);
            }
        });

        $('#savePreferencesBtn').click(() => {
            self.addProcessCount();
            emit("save-preferences", {
                limit_commits: $('#limitCommitsCheckBox').is(':checked'),
                commit_count: parseInt($('#commitCountNumber').val()),
            }).then();
            $('#preferencesModal').modal('hide');
        });

        $('#saveCredentialsBtn').click(() => {
            const $usernameTxt = $('#usernameTxt'),
                $passwordTxt = $('#passwordTxt');
            emit("save-credentials", {username: $usernameTxt.val(), password: $passwordTxt.val()}).then();
            $usernameTxt.val("");
            $passwordTxt.val("");
            $('#credentialsModal').modal('hide');
        });

        $('#commitBtn').click(() => {
            self.addProcessCount();
            const $summaryTxt = $('#summaryTxt'),
                $messageTxt = $('#messageTxt');
            emit("commit", {summaryText: $summaryTxt.val(), messageText: $messageTxt.val()}).then();
            $summaryTxt.val("");
            $messageTxt.val("");
        });

        $('#commitPushBtn').click(() => {
            self.addProcessCount();
            const $summaryTxt = $('#summaryTxt'),
                $messageTxt = $('#messageTxt');
            emit("commit-push", {summaryText: $summaryTxt.val(), messageText: $messageTxt.val()}).then();
            $summaryTxt.val("");
            $messageTxt.val("");
        });

        $('#fetchBtn').click(() => {
            self.addProcessCount();
            emit("fetch").then();
        });

        $('#pullBtn').click(() => {
            self.addProcessCount();
            emit("pull").then();
        });

        $('#openPushModalBtn').click(() => {
            if (Object.hasOwn(self.generalInfo, 'head_has_upstream') && self.generalInfo['head_has_upstream'] === 'true') {
                $('#remoteSelect').hide();
            } else {
                $('#remoteSelect').show();
            }
            $('#forcePushCheckBox').prop('checked', false);
            $('#pushModal').modal('show');
        });

        $('#pushBtn').click(() => {
            self.addProcessCount();
            // Note: By default, pushing will try to use the local branch's upstream first
            // instead of the selected remote from the front-end
            emit("push", {
                selectedRemote: $('#remoteSelect').val(),
                isForcePush: $('#forcePushCheckBox').is(':checked').toString(),
            }).then();
            $('#pushModal').modal('hide');
        });

        $('#openBranchModalBtn').click(() => {
            $('#branchCheckoutCheckBox').prop('checked', true);
            $('#branchModal').modal('show');
        });

        $('#branchBtn').click(() => {
            self.addProcessCount();
            const $branchTxt = $('#branchTxt');
            emit("branch", {branch_name: $branchTxt.val(), checkout_on_create: $('#branchCheckoutCheckBox').is(':checked').toString()}).then();
            $branchTxt.val("");
            $('#branchModal').modal('hide');
        });
    }

    setupTreeViews() {
        const toggler = document.getElementsByClassName("parent-tree");

        for (let i = 0; i < toggler.length; i++) {
            toggler[i].addEventListener("click", togglerClick);
        }
    }

    addProcessCount() {
        this.processCount++;
        $('#mainSpinner').show();
    }

    removeProcessCount() {
        this.processCount--;
        if (this.processCount <= 0) {
            $('#mainSpinner').hide();
            // This should only happen when an error occurs on something that doesn't use the spinner
            if (this.processCount < 0) {
                this.processCount = 0;
            }
        }
    }

    unselectAllRows() {
        const $selectedRow = $('.selected-row');
        $selectedRow.removeClass('selected-row');
        $selectedRow.addClass('hoverable-row');
        $('#fileDiffTable').empty();
    }

    selectRow($row) {
        $row.addClass('selected-row');
        $row.removeClass('hoverable-row');
    }

    showFileDiff(file_info) {
        let $fileDiffTable;
        if (file_info['change_type'] === 'commit') {
            $fileDiffTable = $('#commitFileDiffTable');
        } else if (file_info['change_type'] === 'unstaged' || file_info['change_type'] === 'staged') {
            $fileDiffTable = $('#fileDiffTable');
        }

        $fileDiffTable.empty();
        file_info['file_lines'].forEach((line) => {
            let fileLineRow = '<tr><td class="line-no">';
            if (line['origin'] === '+') {
                fileLineRow = '<tr class="added-code-line"><td class="line-no">';
            } else if (line['origin'] === '-') {
                fileLineRow = '<tr class="removed-code-line"><td class="line-no">';
            }
            if (line['old_lineno'] !== null) {
                fileLineRow += line['old_lineno'];
            }
            fileLineRow += '</td><td class="line-no">';
            if (line['new_lineno'] !== null) {
                fileLineRow += line['new_lineno'];
            }
            fileLineRow += '</td><td>' + line['origin'] + '</td><td class="line-content"><pre><code class="language-' + line['file_type'] + '">' + line['content'] + '</code></pre></td></tr>';
            $fileDiffTable.append($(fileLineRow));
        });
        hljs.highlightAll();
    }

    showCommitInfo(commit_info) {
        const self = this,
            $commitInfo = $('#commit-info'),
            $commitChanges = $('#commitChanges'),
            $commitWindowInfo = $('#commitWindowInfo');

        $commitInfo.empty();
        $commitChanges.empty();
        $('#commitFileDiffTable').empty();

        const formatted_author_time = new Date(commit_info['author_time'] * 1000).toLocaleString();
        $commitWindowInfo.text(commit_info['summary'] + ' - ' + commit_info['author_name'] + ' - ' + formatted_author_time);

        const $newCommitInfo = $('<h4>' + commit_info['author_name'] + '</h4><h4>' + commit_info['committer_name'] + '</h4>');
        $commitInfo.append($newCommitInfo);

        commit_info['changed_files'].forEach(function(file) {
            self.addFileChangeRow($commitChanges, null, file, 'commit', commit_info['sha']);
        });
        self.truncateFilePathText();
    }

    updateAll(repo_info) {
        const self = this;
        self.generalInfo = repo_info['general_info'];
        self.svgManager.updateCommitTable(repo_info["commit_info_list"]);
        self.updateFilesChangedInfo(repo_info['files_changed_info_list']);
        self.updateBranchInfo(repo_info["branch_info_list"]);
        self.updateRemoteInfo(repo_info["remote_info_list"]);
    }

    prependFileIcon($row, status) {
        if (status === 2) {  // Deleted
            $row.prepend('<i class="fa-solid fa-square-minus" style="color:red;"></i> ');
        } else if (status === 3) {  // Modified
            $row.prepend('<i class="fa-solid fa-pen" style="color:goldenrod;"></i> ');
        } else if (status === 7 || status === 1) {  // Untracked or Added
            $row.prepend('<i class="fa-solid fa-square-plus" style="color:green;"></i> ');
        } else if (status === 4) {  // Renamed
            $row.prepend('<i class="fa-solid fa-circle-arrow-right" style="color:mediumpurple;"></i> ');
        } else if (status === 5) {  // Copied
            $row.prepend('<i class="fa-regular fa-copy" style="color:green;"></i> ');
        } else if (status === 10) {  // Conflicted
            $row.prepend('<i class="fa-solid fa-triangle-exclamation" style="color:yellow;"></i> ');
        } else {  // Everything else
            $row.prepend('<i class="fa-solid fa-circle-question" style="color:blue;"></i> ');
        }
    }

    truncateFilePathText() {
        const filePathText = document.getElementsByClassName('file-path-txt');

        for (let i = 0; i < filePathText.length; i++) {
            const txt = filePathText[i],
                shrunkenTxtContainer = txt.parentElement.parentElement;

            // This is so the text can "grow" again.
            txt.textContent = txt.getAttribute('data-original-txt');

            if (txt.clientWidth > 0 && shrunkenTxtContainer.clientWidth > 0) {
                // Set up the text to have ellipsis for width calculations
                if (txt.clientWidth >= shrunkenTxtContainer.clientWidth) {
                    txt.textContent = "..." + txt.textContent;
                }

                while (txt.clientWidth >= shrunkenTxtContainer.clientWidth) {
                    txt.textContent = "..." + txt.textContent.substring(4);

                    // Stop infinite loop from happening if all the text gets filtered out.
                    if (txt.textContent === "...") {
                        break;
                    }
                }
            }
        }
    }

    addFileChangeRow($changesDiv, $button, file, changeType, sha) {
        const self = this,
            // The outer div is the whole row (minus the button), the next inner div is the "unshrunken" text size (i.e. what size the text should fit in), and the last inner div is the size of the text width.
            // This is all used for truncating the text.
            $text = $('<div class="hoverable-row unselectable flex-auto-in-row display-flex-row"><div class="flex-auto-in-row display-flex-row"><div><p class="file-path-txt" data-original-txt="' + file['path'] + '">' + file['path'] + '</p></div></div></div>');
        self.prependFileIcon($text, file['status']);
        $text.click((e) => {
            e.stopPropagation();
            $('#contextMenu').hide();
            self.unselectAllRows();
            self.selectRow($text);
            emit('file-diff', {file_path: file['path'], change_type: changeType, sha: sha}).then();
        });
        const $row = $('<div class="display-flex-row little-padding-bottom"></div>');
        $row.append($text);
        if ($button !== null) {
            $row.append($button);
        }
        $changesDiv.append($row);
    }

    updateFilesChangedInfo(files_changed_info_list) {
        const self = this;

        self.unselectAllRows();

        if (files_changed_info_list['files_changed'] > 0) {
            $('#changes-tab').html('Changes (' + files_changed_info_list['files_changed'] + ')');
        } else {
            $('#changes-tab').html('Changes');
        }

        const $unstagedChanges = $('#unstagedChanges'),
            $stagedChanges = $('#stagedChanges');

        $unstagedChanges.empty();
        $stagedChanges.empty();

        // Unstaged changes
        files_changed_info_list['unstaged_files'].forEach(function(unstagedFile) {
            const $button = $('<button type="button" class="btn btn-success btn-sm right"><i class="fa-solid fa-plus"></i></button>');
            $button.click(function(e) {
                e.stopPropagation();
                emit('stage', unstagedFile).then();
            });
            self.addFileChangeRow($unstagedChanges, $button, unstagedFile, 'unstaged', '');
        });

        // Staged changes
        files_changed_info_list['staged_files'].forEach(function(stagedFile) {
            const $button = $('<button type="button" class="btn btn-danger btn-sm right"><i class="fa-solid fa-minus"></i></button>');
            $button.click(function(e) {
                e.stopPropagation();
                emit('unstage', stagedFile).then();
            });
            self.addFileChangeRow($stagedChanges, $button, stagedFile, 'staged', '');
        });

        self.truncateFilePathText();
    }

    buildBranchResultHTML(currentChildren, $ul, parentTxt) {
        const self = this;
        currentChildren.forEach((child) => {
            if (child['children'].length > 0) {
                const newParentTxt = parentTxt + '-' + child['text'];
                const $nestedList = $('<ul id="' + newParentTxt + '" class="nested sub-tree-view"></ul>');
                self.buildBranchResultHTML(child['children'], $nestedList, newParentTxt);
                const $newListItem = $('<li><span class="parent-tree"><i class="fa-solid fa-caret-down"></i> ' + child['text'] + '</span></li>');
                $newListItem.append($nestedList);
                $ul.append($newListItem);
            } else {
                const $innerListItem = $('<li class="hoverable-row unselectable inner-branch-item"></li>');
                let childText = '';
                if (child['branch_info']['is_head'] === true) {
                    childText += '* ';
                }
                childText += child['text'];
                $innerListItem.text(childText);
                if (child['branch_info']['behind'] !== 0) {
                    const $behindCount = $('<span class="right"><i class="fa-solid fa-arrow-down"></i>' + child['branch_info']['behind'] + '</span>');
                    $innerListItem.append($behindCount);
                }
                if (child['branch_info']['ahead'] !== 0) {
                    const $aheadCount = $('<span class="right"><i class="fa-solid fa-arrow-up"></i>' + child['branch_info']['ahead'] + '</span>');
                    $innerListItem.append($aheadCount);
                }

                if (child['branch_info']['branch_type'] === 'remote') {
                    $innerListItem.on('dblclick', function() {
                        self.addProcessCount();
                        emit("checkout-remote", {full_branch_name: child['branch_info']['full_branch_name'], branch_shorthand: child['branch_info']['branch_shorthand']}).then();
                    });
                } else if (child['branch_info']['branch_type'] === 'local') {
                    $innerListItem.on('dblclick', function() {
                        self.addProcessCount();
                        emit("checkout", child['branch_info']['full_branch_name']).then();
                    });
                }
                $innerListItem.contextmenu(function(e) {
                    e.preventDefault();
                    self.showContextMenu(e, child['branch_info']['branch_shorthand'], child['branch_info']['branch_type']);
                });
                $ul.append($innerListItem);
            }
        });
    }

    updateBranchInfo(branch_info_list) {
        const self = this,
            $localBranches = $('#localBranches'),
            $remoteBranches = $('#remoteBranches'),
            $tags = $('#tags');

        let activeTreeIds = [];
        $('.active-tree').each(function() {
            activeTreeIds.push($(this).attr('id'));
        });

        $localBranches.empty();
        $remoteBranches.empty();
        $tags.empty();

        // The root node is empty, so get its children.
        self.buildBranchResultHTML(branch_info_list['local_branch_info_tree']['children'], $localBranches, "localBranches");
        self.buildBranchResultHTML(branch_info_list['remote_branch_info_tree']['children'], $remoteBranches, "remoteBranches");
        self.buildBranchResultHTML(branch_info_list['tag_branch_info_tree']['children'], $tags, "tags");
        self.setupTreeViews();

        const activeTreeIdsSelector = "#" + activeTreeIds.join(",#");
        $(activeTreeIdsSelector).each(function() {
            $(this).addClass("active-tree");
            $(this).parent().children('.parent-tree').children('.fa-caret-down').addClass('rotated-caret');
        });
    }

    updateRemoteInfo(remote_info_list) {
        if (remote_info_list.length > 0) {
            const $remoteSelect = $('#remoteSelect');
            $remoteSelect.empty();

            remote_info_list.forEach((remoteResult) => {
                let $option = '';
                if (remoteResult === 'origin') {
                    $option = $('<option value="' + remoteResult + '" selected>' + remoteResult + '</option>');
                } else {
                    $option = $('<option value="' + remoteResult + '">' + remoteResult + '</option>');
                }
                $remoteSelect.append($option);
            });
        }
    }

    showContextMenu(event, branchShorthand, branchType) {
        const self = this,
            $contextMenu = $('#contextMenu');
        $contextMenu.empty();
        $contextMenu.css('left', event.pageX + 'px');
        $contextMenu.css('top', event.pageY + 'px');

        const $deleteBtn = $('<button type="button" class="btn btn-outline-danger btn-sm rounded-0 cm-item"><i class="fa-regular fa-trash-can"></i> Delete</button>');
        if (branchType === 'local') {
            $deleteBtn.click(() => {
                self.addProcessCount();
                emit("delete-local-branch", branchShorthand).then();
            });
        } else if (branchType === 'remote') {
            $deleteBtn.click(() => {
                self.addProcessCount();
                emit("delete-remote-branch", branchShorthand).then();
            });
        } else if (branchType === 'tag') {
            $deleteBtn.click(() => {
                self.addProcessCount();
                emit("delete-tag", branchShorthand).then();
            });
        } else {
            $deleteBtn.click(() => {
                alert("Not implemented, sorry!");
            });
        }
        $contextMenu.append($deleteBtn);

        $contextMenu.show();
    }

    showCommitControls() {
        $('#commitControls').show();
        $('#mergeControls').hide();
        $('#cherrypickControls').hide();
    }

    showMergeControls() {
        $('#commitControls').hide();
        $('#mergeControls').show();
        $('#cherrypickControls').hide();
    }

    showCherrypickControls() {
        $('#commitControls').hide();
        $('#mergeControls').hide();
        $('#cherrypickControls').show();
    }
}

$(window).on('load', () => {
    new Main().run();
});
