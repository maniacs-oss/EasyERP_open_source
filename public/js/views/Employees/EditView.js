define([
    'Backbone',
    'jQuery',
    'Underscore',
    'text!templates/Employees/EditTemplate.html',
    'text!templates/Employees/EditTransferTemplate.html',
    'views/Notes/NoteView',
    'views/dialogViewBase',
    'models/TransferModel',
    'collections/transfer/editCollection',
    'common',
    'populate',
    'moment',
    'helpers/keyCodeHelper',
    'constants',
    'helpers',
    'dataService'
], function (Backbone,
             $,
             _,
             EditTemplate,
             EditTransferTemplate,
             NoteView,
             ParentView,
             TransferModel,
             EditCollection,
             common,
             populate,
             moment,
             keyCodes,
             CONSTANTS,
             helpers,
             dataService) {
    'use strict';
    var EditView = ParentView.extend({
        el            : '#content-holder',
        contentType   : 'Employees',
        imageSrc      : '',
        template      : _.template(EditTemplate),
        templateEdit  : _.template(EditTransferTemplate),
        responseObj   : {},
        editCollection: null,
        changedModels : {},
        removeTransfer: [],

        initialize: function (options) {
            var isSalary;
            var transfers;

            _.bindAll(this, 'saveItem', 'render', 'deleteItem');

            if (options.collection) {
                this.employeesCollection = options.collection;
                this.currentModel = this.employeesCollection.getElement();
            } else {
                this.currentModel = options.model;
            }
            this.currentModel.urlRoot = '/employees';
            transfers = this.currentModel.get('transfer');

            isSalary = transfers[0];
            isSalary = isSalary.salary;
            isSalary = !!(isSalary || isSalary === 0);
            this.isSalary = isSalary;

            this.editCollection = new EditCollection(transfers);

            this.responseObj['#sourceDd'] = [
                {
                    _id : 'www.rabota.ua',
                    name: 'www.rabota.ua'
                }, {
                    _id : 'www.work.ua',
                    name: 'www.work.ua'
                }, {
                    _id : 'www.ain.net',
                    name: 'www.ain.net'
                }, {
                    _id : 'other',
                    name: 'other'
                }
            ];

            this.responseObj['#genderDd'] = [
                {
                    _id : 'male',
                    name: 'male'
                }, {
                    _id : 'female',
                    name: 'female'
                }
            ];
            this.responseObj['#maritalDd'] = [
                {
                    _id : 'married',
                    name: 'married'
                }, {
                    _id : 'unmarried',
                    name: 'unmarried'
                }
            ];

            this.removeTransfer = [];
            this.changedModels = {};

            this.render();
        },

        events: {
            'mouseenter .avatar'                                   : 'showEdit',
            'mouseleave .avatar'                                   : 'hideEdit',
            'click .endContractReasonList, .withEndContract .arrow': 'showEndContractSelect',
            'click .withEndContract .newSelectList li'             : 'endContract',
            // 'click .newSelectList li:not(.miniStylePagination, #selectInput)': 'chooseOption',
            'click td.editable'                                    : 'editJob',
            'click #update'                                        : 'addNewRow',
            'keydown .salary'                                      : 'validateNumbers',
            'click .fa-trash'                                      : 'deleteRow',
            'click #jobPosition,#department,#manager,#jobType'     : 'showNotification',
            'change .editable '                                    : 'setEditable',
            'keydown input.editing'                                : 'keyDown'

        },

        keyDown: function (e) {
            if (e.which === 13) {
                this.setChangedValueToModel();
            }
        },

        showNotification: function (e) {
            var msg;

            e.preventDefault();

            msg = 'You can edit ';
            msg += e.currentTarget.id;
            msg += ' at "Job" tab';

            App.render({
                type   : 'notify',
                message: msg
            });
        },

        deleteRow: function (e) {
            var target = $(e.target);
            var tr = target.closest('tr');
            var transferId = tr.attr('id');
            var prevTr = tr.prev('tr');
            var prevTrId;
            var transfer;
            var editRow;

            if (prevTr.length) {
                prevTrId = prevTr.attr('id');
                transfer = this.editCollection.get(prevTrId);
                editRow = this.templateEdit({
                    transfer        : transfer.toJSON(),
                    currencySplitter: helpers.currencySplitter
                });
                prevTr.after(editRow);
                prevTr.remove();
            }

            tr.remove();

            this.$el.find('.withEndContract').show();

            this.$el.find('#update').show();

            this.renderRemoveBtn();

            this.editCollection.remove(this.editCollection.get(transferId));

            delete this.changedModels[transferId];

            if (transferId && transferId.length >= 24) {
                this.removeTransfer.push(transferId);
            }
        },

        validateNumbers: function (e) {
            var $target = $(e.target);
            var code = e.keyCode;
            var inputValue = $target.val();

            if (!keyCodes.isDigitOrDecimalDot(code) && !keyCodes.isBspaceAndDelete(code)) {
                $target.val(parseFloat(inputValue) || '');
                return false;
            }
        },

        addNewRow: function (e, contractEndReason) {
            var $thisEl = this.$el;
            var table = $thisEl.find('#hireFireTable');
            var lastTr = table.find('tr').last();
            var newTr = lastTr.clone();
            var trId = newTr.attr('data-id');
            var now = moment();

            var $tr;
            var salary;
            var manager;
            var dateText;
            var date;
            var jobPosition;
            var weeklyScheduler;
            var department;
            var jobType;
            var info;
            var event;
            var employeeId;
            var transfer;
            var model;
            var payrollStructureType;
            var scheduledPay;

            lastTr.find('a').removeClass('current-selected');
            lastTr.find('[data-content="date"]').removeClass('editable');
            lastTr.find('[data-content="salary"]').removeClass('editable');
            lastTr.find('[data-content="info"]').removeClass('editable');

            now = common.utcDateToLocaleDate(now);

            newTr.attr('data-id', ++trId);
            newTr.find('td').eq(2).text(now);

            if (contractEndReason) {
                newTr.attr('data-content', 'fired');
                newTr.find('td').eq(1).text('fired');
                // newTr.find('td').last().find('input').val(contractEndReason);
                newTr.find('td').last().html('<input class="editing salary statusInfo" type="text" value="' + contractEndReason + '">');
            } else {
                newTr.attr('data-content', 'updated');
                newTr.find('td').eq(1).text('updated');
            }

            table.append(newTr);

            $thisEl.find('.withEndContract').hide();

            this.renderRemoveBtn();

            $tr = newTr;
            salary = parseInt(helpers.spaceReplacer($tr.find('[data-id="salary"] input').val() || $tr.find('[data-id="salary"]').text()), 10) || 0;
            manager = $tr.find('#projectManagerDD').attr('data-id') || null;
            dateText = $.trim($tr.find('td').eq(2).text());
            date = dateText ? helpers.setTimeToDate(new Date(dateText)) : helpers.setTimeToDate(new Date());
            jobPosition = $tr.find('#jobPositionDd').attr('data-id');
            weeklyScheduler = $tr.find('#weeklySchedulerDd').attr('data-id');
            payrollStructureType = $tr.find('#payrollStructureTypeDd').attr('data-id') || null;
            scheduledPay = $tr.find('#scheduledPayDd').attr('data-id') || null;
            department = $tr.find('#departmentsDd').attr('data-id');
            jobType = $.trim($tr.find('#jobTypeDd').text());
            info = $tr.find('#statusInfoDd').val();
            event = $tr.attr('data-content');
            employeeId = this.currentModel.get('_id');

            transfer = {
                employee            : employeeId,
                status              : event,
                date                : date,
                department          : department,
                jobPosition         : jobPosition,
                manager             : manager,
                jobType             : jobType,
                salary              : salary,
                info                : info,
                weeklyScheduler     : weeklyScheduler,
                payrollStructureType: payrollStructureType,
                scheduledPay        : scheduledPay
            };
            model = new TransferModel(transfer);
            newTr.attr('id', model.cid);
            this.changedModels[model.cid] = transfer;
            this.editCollection.add(model);

            $('#update').hide();
        },

        renderRemoveBtn: function () {
            var table = this.$el.find('#hireFireTable');
            var trs = table.find('tr');
            var removeBtn = CONSTANTS.TRASH_BIN;
            var lastTr;
            var status;

            trs.find('td:first-child').text('');
            lastTr = trs.last();

            status = lastTr.attr('data-content');
            if (status !== 'hired' && status !== 'fired') {
                lastTr.find('td').first().html(removeBtn);
            }
        },

        editJob: function (e) {
            var self = this;
            var $target = $(e.target);
            var dataContent = $target.attr('data-content');
            var tempContainer;
            var $tr = $target.parent('tr');
            var modelId = $tr.attr('id');

            var minDate = new Date('1995-01-01');
            var maxDate = null;
            var model = this.editCollection.get(modelId);

            tempContainer = ($target.text()).trim();

            if (dataContent === 'salary') {
                $target.html('<input class="editing salary statusInfo" type="text" value="' + tempContainer + '">');

                return false;
            }

            if (dataContent === 'info') {
                $target.html('<input class="editing statusInfo" type="text" value="' + tempContainer + '">');

                return false;
            }

            $target.html('<input class="editing statusInfo" type="text" value="' + tempContainer + '" ' + 'readonly' + '>');

            if (($tr.prev()).length) {
                minDate = new Date($tr.prev().find('td.date').text());
            }

            if ($tr.next()) {
                maxDate = new Date($tr.next().find('td.date').text());
            }

            $target.find('.editing').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true,
                minDate    : minDate,
                maxDate    : maxDate,
                onSelect   : function () {
                    var editingDates = self.$el.find('.editing');

                    editingDates.each(function () {
                        var target = $(this);
                        var datacontent;
                        var changedAttr;

                        if (!self.changedModels[modelId]) {
                            if (!model.id) {
                                self.changedModels[modelId] = model.attributes;
                            } else {
                                self.changedModels[modelId] = {};
                            }
                        }

                        datacontent = target.closest('td').attr('data-content');

                        changedAttr = self.changedModels[modelId];
                        if (datacontent === 'date') {
                            changedAttr[datacontent] = helpers.setTimeToDate(new Date(target.val()));
                        } else {
                            changedAttr[datacontent] = target.val();
                        }

                        target.parent().text(target.val()).removeClass('changeContent');
                        target.remove();
                    });
                }
            }).addClass('datepicker');

            return false;
        },

        setChangedValueToModel: function () {
            var editedElement = this.$el.find('#hireFireTable').find('.editing');
            var editedCol;
            var editedElementRowId;
            var editedElementContent;
            var editedElementValue;
            var editModel;
            var editValue;

            if (navigator.userAgent.indexOf('Firefox') > -1) {
                this.setEditable(editedElement);
            }

            if (editedElement.length) {
                editedCol = editedElement.closest('td');
                editedElementRowId = editedElement.closest('tr').attr('id');
                editedElementContent = editedCol.data('content');
                editedElementValue = editedElement.val();

                // editedElementValue = editedElementValue.replace(/\s+/g, '');

                if (editedElementRowId.length >= 24) {
                    editModel = this.editCollection.get(editedElementRowId);
                    editValue = editModel.get(editedElementContent);

                    if (editedElementValue !== editValue) {
                        if (!this.changedModels[editedElementRowId]) {
                            this.changedModels[editedElementRowId] = {};
                        }

                        if (editedElementContent === 'salary') {
                            editedElementValue = helpers.spaceReplacer(editedElementValue);
                        }
                        this.changedModels[editedElementRowId][editedElementContent] = editedElementValue;
                    }
                } else {
                    if (!this.changedModels[editedElementRowId]) {
                        this.changedModels[editedElementRowId] = {};
                    }
                    if (editedElementContent === 'salary') {
                        editedElementValue = helpers.spaceReplacer(editedElementValue);
                    }
                    this.changedModels[editedElementRowId][editedElementContent] = editedElementValue;
                }
                editedCol.text(editedElementValue);
                editedElement.remove();

                if (editedElementValue) {
                    editedCol.removeClass('errorContent');
                }
            }
        },

        chooseOption: function (e) {
            var $target = $(e.target);
            var $parentUl = $target.parent();
            var $element = $target.closest('a') || $parentUl.closest('a');
            var id = $element.attr('id') || $parentUl.attr('id');
            var modelId = $element.closest('tr').attr('id');
            var model = this.editCollection.get(modelId);
            var valueId = $target.attr('id');
            var managersIds = this.responseObj['#departmentManagers'];
            var managers = this.responseObj['#projectManagerDD'];
            var managerId;
            var manager;
            var changedAttr;
            var datacontent;

            e.stopPropagation();

            if (id === 'jobPositionDd' || id === 'departmentsDd' ||
                id === 'projectManagerDD' || id === 'jobTypeDd' ||
                id === 'hireFireDd' || id === 'scheduledPayDd' ||
                id === 'payrollStructureTypeDd') {

                this.setEditable($element);

                if (!this.changedModels[modelId]) {
                    if (model && !model.id) {
                        this.changedModels[modelId] = model.attributes;
                    } else {
                        this.changedModels[modelId] = {};
                    }
                }

                $element.text($target.text());
                $element.attr('data-id', valueId);
                datacontent = $element.attr('data-content');

                changedAttr = this.changedModels[modelId];
                changedAttr[datacontent] = valueId;

                if (id === 'departmentsDd') {

                    managersIds.forEach(function (managerObj) {
                        if (managerObj._id === valueId) {
                            managerId = managerObj.name;
                        }
                    });

                    managers.forEach(function (managerObj) {
                        if (managerObj._id === managerId) {
                            manager = managerObj.name;
                        }
                    });

                    if (manager) {
                        $element = $element.closest('tr').find('a#projectManagerDD');

                        $element.text(manager);
                        $element.attr('data-id', managerId);
                    }

                    changedAttr.transfered = true;
                }

            } else {
                $target.parents('dd').find('.current-selected').text($target.text()).attr('data-id', $target.attr('id'));
            }
        },

        setEditable: function (td) {
            var tr;

            if (!td.parents) {
                td = $(td.target).closest('td');
            }

            tr = td.parents('tr');

            tr.addClass('edited');

            return false;
        },

        showEndContractSelect: function (e) {
            e.preventDefault();
            $(e.target).parent().find('.newSelectList').toggle();

            return false;
        },

        activeTab: function () {
            var $tabs;
            var $activeTab;
            var $dialogHolder;
            var tabId;

            tabId = 'job';
            $tabs = this.$el.find('.dialog-tabs');
            $activeTab = $tabs.find('.active');

            $activeTab.removeClass('active');
            $tabs.find('#' + tabId + 'Tab').addClass('active');

            $dialogHolder = this.$el.find('.dialog-tabs-items');
            $dialogHolder.find('.dialog-tabs-item.active').removeClass('active');
            $dialogHolder.find('#' + tabId).closest('.dialog-tabs-item').addClass('active');
        },

        endContract: function (e) {
            var contractEndReason = $(e.target).text();

            this.activeTab();

            this.addNewRow(null, contractEndReason);
        },

        saveItem: function () {
            var $thisEl = this.$el;
            var weeklyScheduler;
            var transferArray;
            var homeAddress;
            var dateBirthSt;
            var self = this;
            var previousDep;
            var nationality;
            var jobPosition;
            var relatedUser;
            var isEmployee;
            var $jobTable;
            var department;
            var hireArray;
            var fireArray;
            var lastFire;
            var whoCanRW;
            var sourceId;
            var groupsId;
            var empThumb;
            var dataType;
            var manager;
            var marital;
            var jobType;
            var usersId;
            var $jobTrs;
            var salary;
            var gender;
            var coach;
            var event;
            var quit;
            var data;
            var date;
            var info;
            var haveSalary;

            this.setChangedValueToModel();

            relatedUser = $thisEl.find('#relatedUsersDd').attr('data-id') || null;
            coach = $.trim($thisEl.find('#coachDd').attr('data-id')) || null;
            whoCanRW = $thisEl.find("[name='whoCanRW']:checked").val();
            dateBirthSt = helpers.setTimeToDate($.trim(self.$el.find('#dateBirth').val()));
            $jobTable = $thisEl.find('#hireFireTable');
            marital = $thisEl.find('#maritalDd').attr('data-id') || null;
            nationality = $thisEl.find('#nationality').attr('data-id');
            gender = $thisEl.find('#genderDd').attr('data-id') || null;
            $jobTrs = $jobTable.find('tr.transfer');
            sourceId = $thisEl.find('#sourceDd').attr('data-id');
            homeAddress = {};
            // transferArray = [];
            fireArray = [];
            hireArray = [];
            groupsId = [];
            usersId = [];

            $thisEl.find('dd').find('.homeAddress').each(function (index, addressLine) {
                var $el = $thisEl.find(addressLine);
                homeAddress[$el.attr('name')] = $.trim($el.val());
            });

            haveSalary = !!$jobTrs.find('td[data-id="salary"]').length;

            manager = $jobTrs.find('#projectManagerDD').last().attr('data-id') || null;
            jobPosition = $jobTrs.find('#jobPositionDd').last().attr('data-id');
            department = $jobTrs.find('#departmentsDd').last().attr('data-id');
            weeklyScheduler = $jobTrs.find('#weeklySchedulerDd').last().attr('data-id');
            event = $jobTrs.last().attr('data-content');
            jobType = $.trim($jobTrs.last().find('#jobTypeDd').text());
            date = $.trim($jobTrs.last().find('td').eq(2).text());
            date = date ? helpers.setTimeToDate(new Date(date)) : helpers.setTimeToDate(new Date());

            $.each($jobTrs, function (index, $tr) {
                var _$tr = $tr;
                var _date;
                var _event;

                _$tr = $thisEl.find(_$tr);
                _date = $.trim(_$tr.find('td').eq(2).text());
                _date = _date ? helpers.setTimeToDate(new Date(_date)) : helpers.setTimeToDate(new Date());
                _event = _$tr.attr('data-content');

                if (_event === 'fired') {
                    fireArray.push(_date);
                    _date = moment(_date);
                    lastFire = _date.year() * 100 + _date.isoWeek();
                }

                if (_event === 'hired') {
                    hireArray.push(_date);
                }
            });

            if (quit) {
                return;
            }

            isEmployee = (event === 'hired') || (event === 'updated');

            $thisEl.find('.groupsAndUser tr').each(function (index, element) {
                dataType = self.$el.find(element).attr('data-type');

                if (dataType === 'targetUsers') {
                    usersId.push(self.$el.find(element).attr('data-id'));
                }

                if (dataType === 'targetGroups') {
                    groupsId.push(self.$el.find(element).attr('data-id'));
                }

            });

            data = {
                name: {
                    first: $.trim($thisEl.find('#first').val()),
                    last : $.trim($thisEl.find('#last').val())
                },

                gender     : gender,
                jobType    : jobType,
                marital    : marital,
                workAddress: {
                    street : $.trim($thisEl.find('#street').val()),
                    city   : $.trim($thisEl.find('#city').val()),
                    state  : $.trim($thisEl.find('#state').val()),
                    zip    : $.trim($thisEl.find('#zip').val()),
                    country: $.trim($thisEl.find('#country').val())
                },

                social: {
                    LI: $.trim($thisEl.find('#LI').val()),
                    FB: $.trim($thisEl.find('#FB').val())
                },

                tags         : $.trim($thisEl.find('#tags').val()).split(','),
                workEmail    : $.trim($thisEl.find('#workEmail').val()),
                personalEmail: $.trim($thisEl.find('#personalEmail').val()),
                skype        : $.trim($thisEl.find('#skype').val()),
                workPhones   : {
                    phone : $.trim($thisEl.find('#phone').val()),
                    mobile: $.trim($thisEl.find('#mobile').val())
                },

                officeLocation : $.trim($thisEl.find('#officeLocation').val()),
                bankAccountNo  : $.trim($thisEl.find('#bankAccountNo').val()),
                relatedUser    : relatedUser,
                department     : department,
                jobPosition    : jobPosition,
                weeklyScheduler: weeklyScheduler,
                manager        : manager,
                coach          : coach,
                identNo        : $.trim($thisEl.find('#identNo').val()),
                passportNo     : $.trim($thisEl.find('#passportNo').val()),
                otherId        : $.trim($thisEl.find('#otherId').val()),
                homeAddress    : homeAddress,
                dateBirth      : dateBirthSt,
                source         : sourceId,
                imageSrc       : self.imageSrc,
                nationality    : nationality,
                isEmployee     : isEmployee,
                lastFire       : lastFire,
                groups         : {
                    owner: $thisEl.find('#allUsersSelect').attr('data-id') || null,
                    users: usersId,
                    group: groupsId
                },

                whoCanRW: whoCanRW,
                hire    : hireArray,
                fire    : fireArray
            };

            if (!haveSalary) {
                delete data.transfer;
            }

            if (!isEmployee) {
                data.workflow = CONSTANTS.END_CONTRACT_WORKFLOW_ID;
            }

            this.currentModel.set(data);
            this.currentModel.save(this.currentModel.changed, {
                headers: {
                    mid: 39
                },
                wait   : true,
                patch  : true,
                success: function (model) {

                    var modelChanged;
                    var id;
                    var transferNewModel;
                    var keys;
                    var key;
                    var i;
                    var k;
                    var keysChanged = Object.keys(self.changedModels);

                    for (k = keysChanged.length - 1; k >= 0; k--) {
                        id = keysChanged[k];

                        modelChanged = self.editCollection.get(id);
                        modelChanged.changed = self.changedModels[id];

                        if (self.changedModels[id].transfered) {
                            modelChanged.changed.transferKey = new Date().getTime();
                            transferNewModel = new TransferModel(modelChanged.attributes);
                            keys = Object.keys(modelChanged.attributes);
                            for (i = keys.length - 1; i >= 0; i--) {
                                key = keys[i];
                                if (key !== '_id') {
                                    transferNewModel.changed[key] = modelChanged.attributes[key];
                                }
                            }
                            delete transferNewModel.attributes._id;
                            delete transferNewModel._id;
                            delete transferNewModel.id;
                            transferNewModel.changed.date = moment(modelChanged.changed.date).subtract(1, 'day');
                            transferNewModel.changed.status = 'transfer';
                            transferNewModel.changed.transferKey = modelChanged.changed.transferKey;
                            self.editCollection.add(transferNewModel);
                        }
                    }

                    self.editCollection.save();

                    if (self.removeTransfer.length) {
                        dataService.deleteData(CONSTANTS.URLS.TRANSFER, {removeTransfer: self.removeTransfer}, function (err, response) {
                            if (err) {
                                return App.render({
                                    type   : 'error',
                                    message: 'Can\'t remove items'
                                });
                            }
                        });
                    }

                    self.deleteEditable();
                    self.changedModels = {};

                    if (!isEmployee) {
                        return Backbone.history.navigate('easyErp/Applications/kanban', {trigger: true});
                    }

                    if (model.get('relatedUser') === App.currentUser._id) {
                        App.currentUser.imageSrc = self.imageSrc;

                        $('#loginPanel .iconEmployee').attr('src', self.imageSrc);
                        $('#loginPanel #userName').text(model.toJSON().fullName);
                    }

                    if (self.firstData === data.name.first &&
                        self.lastData === data.name.last &&
                        self.departmentData === department &&
                        self.jobPositionData === jobPosition &&
                        self.projectManagerData === manager) {

                        model = model.toJSON();
                        empThumb = $('#' + model._id);

                        empThumb.find('.age').html(model.age);
                        empThumb.find('.empDateBirth').html('(' + model.dateBirth + ')');
                        empThumb.find('.telephone a').html(model.workPhones.mobile);
                        empThumb.find('.telephone a').attr('href', 'skype:' + model.workPhones.mobile + '?call');

                        if (model.relatedUser) {
                            empThumb.find('.relUser').html(model.relatedUser.login);
                        }

                    } else {
                        Backbone.history.fragment = '';
                        Backbone.history.navigate(window.location.hash, {trigger: true, replace: true});
                    }

                    self.hideDialog();

                },

                error: function (model, xhr) {
                    self.errorNotification(xhr);
                }

            });

        },

        deleteEditable: function () {
            this.$el.find('.edited').removeClass('edited');
        },

        render: function () {
            var $lastElement;
            var $firstElement;
            var $jobPosElement;
            var $departmentElement;
            var $projectManagerElement;
            var formString = this.template({
                model           : this.currentModel.toJSON(),
                currencySplitter: helpers.currencySplitter
            });
            var transfer = this.currentModel.toJSON().transfer;
            var lastTransfer = transfer[transfer.length - 1];
            var editRow;
            var self = this;
            var notDiv;
            var $thisEl;
            var lastTr;
            var firstEL = false;

            if (lastTransfer.status === 'transfer') {
                lastTransfer = transfer[transfer.length - 2] || null;
                firstEL = transfer.length - 2 === 0;
            }

            editRow = this.templateEdit({
                transfer        : lastTransfer,
                currencySplitter: helpers.currencySplitter
            });

            if (this.currentModel.get('dateBirth')) {
                this.currentModel.set({
                    dateBirth: this.currentModel.get('dateBirth').split('T')[0].replace(/-/g, '/')
                }, {
                    silent: true
                });
            }

            this.$el = $(formString).dialog({
                closeOnEscape: false,
                dialogClass  : 'edit-dialog',
                width        : 1000,
                buttons      : {
                    save: {
                        text : 'Save',
                        class: 'btn',
                        click: self.saveItem
                    },

                    cancel: {
                        text : 'Cancel',
                        class: 'btn',
                        click: self.hideDialog
                    },

                    delete: {
                        text : 'Delete',
                        class: 'btn',
                        click: self.deleteItem
                    }
                }
            });
            $thisEl = this.$el;

            if (firstEL) {
                lastTr = $thisEl.find('#transfersTable');
                lastTr.html(editRow);
            } else {
                if (transfer.length === 1 && lastTransfer) {
                    lastTr = $thisEl.find('#transfersTable');
                    lastTr.append(editRow);
                } else if (lastTransfer) {
                    lastTr = $thisEl.find('.transfer').last();
                    lastTr.after(editRow);
                }
            }

            notDiv = $thisEl.find('.attach-container');
            notDiv.append(
                new NoteView({
                    model      : this.currentModel,
                    contentType: self.contentType
                }).render().el
            );

            this.renderAssignees(this.currentModel);

            this.renderRemoveBtn();

            common.getWorkflowContractEnd('Applications', null, null, CONSTANTS.URLS.WORKFLOWS, null, 'Contract End', function (workflow) {
                self.$el.find('.endContractReasonList').attr('data-id', workflow[0]._id);
            });
            populate.get('#departmentManagers', CONSTANTS.URLS.DEPARTMENTS_FORDD, {}, 'departmentManager', this);
            populate.get('#weeklySchedulerDd', CONSTANTS.URLS.WEEKLYSCHEDULER, {}, 'name', this);
            populate.get('#jobTypeDd', CONSTANTS.URLS.JOBPOSITIONS_JOBTYPE, {}, 'name', this);
            populate.get('#nationality', CONSTANTS.URLS.EMPLOYEES_NATIONALITY, {}, '_id', this);
            populate.get2name('#projectManagerDD', CONSTANTS.URLS.EMPLOYEES_PERSONSFORDD, {}, this);
            populate.get('#jobPositionDd', CONSTANTS.URLS.JOBPOSITIONS_FORDD, {}, 'name', this, false, false);
            populate.get('#relatedUsersDd', CONSTANTS.URLS.USERS_FOR_DD, {}, 'login', this, false, true);
            populate.get('#departmentsDd', CONSTANTS.URLS.DEPARTMENTS_FORDD, {}, 'name', this);
            populate.get('#payrollStructureTypeDd', CONSTANTS.URLS.PAYROLLSTRUCTURETYPES_FORDD, {}, 'name', this);
            populate.get('#scheduledPayDd', CONSTANTS.URLS.SCHEDULEDPAY_FORDD, {}, 'name', this);

            common.canvasDraw({model: this.currentModel.toJSON()}, this);

            $thisEl.find('#dateBirth').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true,
                yearRange  : '-100y:c+nn',
                maxDate    : '-18y',
                minDate    : null
            });

            $thisEl.find('.date').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true
            });

            this.hiredDate = this.currentModel.get('hire')[0];

            this.delegateEvents(this.events);

            $lastElement = $thisEl.find('#last');
            $firstElement = $thisEl.find('#first');
            $jobPosElement = $thisEl.find('#jobPosition');
            $departmentElement = $thisEl.find('#department');
            $projectManagerElement = $thisEl.find('#manager');

            this.lastData = $.trim($lastElement.val());
            this.firstData = $.trim($firstElement.val());
            this.jobPositionData = $.trim($jobPosElement.attr('data-id'));
            this.departmentData = $.trim($departmentElement.attr('data-id'));
            this.projectManagerData = $.trim($projectManagerElement.attr('data-id'));

            return this;
        }

    });

    return EditView;
});
