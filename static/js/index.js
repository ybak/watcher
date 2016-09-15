const ipcRenderer = nodeRequire('electron').ipcRenderer;

Handlebars.registerHelper('formatDate', function(date) {
    return  moment(date).format('YYYY-MM-DD hh:mm:ss');
});

$(function () {
    //提交表单
    $('form.searchForm').submit(function (event) {
        $('#waitModal').modal('show');
        event.preventDefault();
        ipcRenderer.send('search-keyword', $('input.keyword').val());
        ipcRenderer.on('search-reply', function(event, data) {
            $('#waitModal').modal('hide');
            if (data.content) {
                var template = Handlebars.compile($('#template').html());
                $('div.list-group').html(template(data));
            }
        });
    });

    //增量更新全部邮件
    $('button.update-all').click(function (e) {
        e.preventDefault();

        let channel = 'crawl-job-' + Date.now();
        ipcRenderer.on(channel, function(event, msg) {
            console.log('Msg Received: ' + JSON.stringify(msg));
            let progress = msg.progress;
            $('#progressModal .progress-bar').width(progress + '%');
            if (progress >= 100) {
                $('#progressModal').modal('hide');
            }
        });
        ipcRenderer.send('start-crawl', channel);

        $('#progressModal .progress-bar').width('0%');
        $('#progressModal').modal('show');

    });

    //更新当前邮件
    $(document).on('click', '.updateBtn', function (e) {
        $('#waitModal').modal('show');
        e.preventDefault();
        var $target = $(this);
        var id = $target.data('id'),
            url = $target.data('url');
        $.post('/update', {'id': id, 'url': url}, function (data) {
            $('#waitModal').modal('hide');
            $target.closest('.mail-item').find('.result').text(data.result);
        });
    });

});
