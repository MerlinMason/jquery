//Javascript Version:

$("#btnJs").click(function () {

	var showConsole = $("input[name='console']").is(":checked");

	if (showConsole) 
		console.log("pure JS here")
	
    $.ajax({
        async: true,
        type: "POST",
        url: "http://localhost:3000/",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        beforeSend: function (data) {
        	if (showConsole) 
            	console.log(" before:", data);
        },
        success: function (data) {
        	var dataStr = JSON.stringify(data);
            $("#inTextArea").val(dataStr);
            if (showConsole) 
          		console.log(" success:", data);  
          	
        },
        error: function (status) {
        	if (showConsole) 
          		console.log(" error:", status);
        }
    });
});

$("#btnClear").click(function () {
    $("textarea").val("");
});