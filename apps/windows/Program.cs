using System.Diagnostics;
using System.Text.Json;
using System.Net.Http.Headers;
using System.Drawing.Drawing2D;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

namespace Turkuaz3DWeb;
static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TurkuazWindow());
    }
}
sealed class TurkuazWindow : Form
{
    private readonly WebView2 view = new();
    private readonly Label status = new();
    private readonly NotifyIcon tray = new();
    private bool allowExit = false;
    private readonly System.Windows.Forms.Timer backgroundTimer = new() { Interval = 12000 };
    private readonly HttpClient visitorClient = new() { Timeout = TimeSpan.FromSeconds(8) };
    private bool checkingBackground = false;
    private long backgroundCursor = -1;
    private const string Url = "https://turkuaz3d.com/yonetim/?mode=windows&view=stats";

    public TurkuazWindow()
    {
        Text = "Turkuaz 3D Web — Yönetim";
        Width = 1360; Height = 880; MinimumSize = new Size(850, 580);
        BackColor = Color.FromArgb(6, 24, 36);
        ForeColor = Color.FromArgb(228, 251, 252);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        var header = new Panel { Dock = DockStyle.Top, Height = 70, BackColor = Color.FromArgb(7,29,43) };
        var logo = new Panel { Left = 16, Top = 9, Height = 51, Width = 51 };
        logo.Paint += (_,e) => {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var pen = new Pen(Color.FromArgb(0,228,223), 3);
            Point[] outer = {new(25,2),new(47,14),new(47,39),new(25,49),new(3,39),new(3,14)};
            e.Graphics.DrawPolygon(pen,outer);
            e.Graphics.DrawLine(pen,3,14,25,27);
            e.Graphics.DrawLine(pen,25,27,47,14);
            e.Graphics.DrawLine(pen,25,27,25,49);
        };
        var brand = new Label { Text = "TURKUAZ 3D WEB", Left = 80, Top = 9, Width = 420, Height = 34,
            Font = new Font("Segoe UI",18,FontStyle.Bold), ForeColor = Color.FromArgb(0,228,223) };
        status.Text="Mobil ve masaüstü tasarım yönetimi";
        status.Left=82;status.Top=41;status.Width=410;status.Height=23;
        status.ForeColor=Color.FromArgb(178,209,215);
        var site = new Button { Text="Siteyi aç ↗", Width=125,Height=35,Anchor=AnchorStyles.Right|AnchorStyles.Top,
            Left=Width-170,Top=18,FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(20,65,76),
            ForeColor=Color.White };
        header.Resize += (_,_) => site.Left=header.ClientSize.Width-site.Width-20;
        site.Click += (_,_)=>Process.Start(new ProcessStartInfo("https://turkuaz3d.com/"){UseShellExecute=true});
        header.Controls.AddRange(new Control[]{logo,brand,status,site});
        view.Dock=DockStyle.Fill;
        Controls.Add(view);Controls.Add(header);
        tray.Icon = SystemIcons.Information;
        tray.Text = "Turkuaz 3D Web";
        tray.Visible = true;
        var context = new ContextMenuStrip();
        context.Items.Add("Turkuaz 3D Web'i aç", null, (_,_) => { Show(); WindowState = FormWindowState.Normal; Activate(); });
        context.Items.Add("Programdan çık", null, (_,_) => { allowExit = true; Close(); });
        tray.ContextMenuStrip = context;
        tray.DoubleClick += (_,_) => { Show(); WindowState = FormWindowState.Normal; Activate(); };
        backgroundTimer.Tick += async (_,_) => await CheckBackgroundVisits();
        backgroundTimer.Start();
        Shown += async (_,_) => await LoadEditor();
    }

    protected override void OnFormClosing(FormClosingEventArgs e) {
        if (!allowExit && e.CloseReason == CloseReason.UserClosing) {
            e.Cancel = true;
            Hide(); // Keep the dashboard polling in the Windows tray.
            tray.ShowBalloonTip(1500, "Turkuaz 3D Web", "Ziyaretçi takibi arka planda açık.", ToolTipIcon.Info);
            return;
        }
        backgroundTimer.Stop();
        backgroundTimer.Dispose();
        visitorClient.Dispose();
        tray.Visible = false;
        tray.Dispose();
        base.OnFormClosing(e);
    }
    private async Task CheckBackgroundVisits() {
        if (checkingBackground || view.CoreWebView2 == null ||
            (Visible && WindowState != FormWindowState.Minimized)) return;
        checkingBackground = true;
        try {
            // The access key stays in this computer's WebView profile and is sent
            // only to the trusted owner's configured Cloudflare endpoint.
            string js = await view.CoreWebView2.ExecuteScriptAsync(
                "JSON.stringify({worker:localStorage.getItem('t3-analytics-worker'),key:localStorage.getItem('t3-analytics-access')})");
            string config = JsonSerializer.Deserialize<string>(js) ?? "{}";
            using var doc = JsonDocument.Parse(config);
            string endpoint = doc.RootElement.GetProperty("worker").GetString() ?? "";
            string key = doc.RootElement.GetProperty("key").GetString() ?? "";
            if (!Uri.TryCreate(endpoint,UriKind.Absolute,out var service) ||
                service.Scheme != "https" || key.Length < 32) return;
            string route=backgroundCursor < 0 ? "/v1/stats" : "/v1/events?after="+backgroundCursor;
            using var request = new HttpRequestMessage(HttpMethod.Get,endpoint.TrimEnd('/')+route);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer",key);
            request.Headers.TryAddWithoutValidation("Origin","https://turkuaz3d.com");
            using var response = await visitorClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return;
            using var reply=JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            if (backgroundCursor < 0) {
                backgroundCursor=reply.RootElement.TryGetProperty("cursor",out var c) ? c.GetInt64() : 0;
                return;
            }
            if (!reply.RootElement.TryGetProperty("events",out var events)) return;
            foreach(var visitor in events.EnumerateArray()) {
                long id=visitor.GetProperty("id").GetInt64();
                if(id<=backgroundCursor)continue;
                backgroundCursor=id;
                string city=visitor.GetProperty("city").GetString()??"Bilinmiyor";
                string country=visitor.GetProperty("country").GetString()??"Bilinmiyor";
                string page=visitor.GetProperty("page").GetString()??"/";
                tray.ShowBalloonTip(4000,"Turkuaz 3D Web · Yeni ziyaret",
                    (city+", "+country+" · "+page)[..Math.Min(180,(city+", "+country+" · "+page).Length)],ToolTipIcon.Info);
            }
        } catch (Exception) {} finally {checkingBackground=false;}
    }

    private async Task LoadEditor()
    {
        try
        {
            // Keep the WebView2 profile in the user's AppData, not next to the EXE.
            // This preserves local settings whenever Windows app EXE is replaced or moved.
            string profile = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Turkuaz3DWeb", "WebView2");
            Directory.CreateDirectory(profile);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
            await view.EnsureCoreWebView2Async(environment);
            view.CoreWebView2.Settings.AreDevToolsEnabled = false;
            view.CoreWebView2.WebMessageReceived += (_,message) => {
                // Only trust messages from our own protected administration origin.
                if (!message.Source.StartsWith("https://turkuaz3d.com/yonetim/", StringComparison.OrdinalIgnoreCase)) return;
                if (!Visible || WindowState == FormWindowState.Minimized) return; // Avoid duplicate tray notifications
                try {
                    using var doc = JsonDocument.Parse(message.WebMessageAsJson);
                    if (!doc.RootElement.TryGetProperty("type",out var type) || type.GetString() != "new-visit") return;
                    string title=doc.RootElement.TryGetProperty("title",out var t) ? (t.GetString()??"Turkuaz 3D") : "Turkuaz 3D";
                    string body=doc.RootElement.TryGetProperty("message",out var m) ? (m.GetString()??"Yeni ziyaret") : "Yeni ziyaret";
                    title=title[..Math.Min(title.Length,60)];body=body[..Math.Min(body.Length,220)];
                    tray.BalloonTipTitle=title;tray.BalloonTipText=body;
                    tray.ShowBalloonTip(6000);
                    status.Text = "Son ziyaret: " + body;
                } catch (Exception) {}
            };
            view.CoreWebView2.NewWindowRequested += (_,args) => {
                args.Handled=true;
                if(Uri.TryCreate(args.Uri,UriKind.Absolute,out var target) && target.Scheme=="https")
                    Process.Start(new ProcessStartInfo(target.ToString()){UseShellExecute=true});
            };
            view.CoreWebView2.NavigationStarting += (_,args)=>{
                if(!args.Uri.StartsWith("https://turkuaz3d.com/yonetim/",StringComparison.OrdinalIgnoreCase)){
                    args.Cancel=true;
                    if(Uri.TryCreate(args.Uri,UriKind.Absolute,out var dest) && dest.Scheme=="https")
                        Process.Start(new ProcessStartInfo(dest.ToString()){UseShellExecute=true});
                }
            };
            view.Source=new Uri(Url);
        }
        catch(Exception ex)
        {
            MessageBox.Show("Yönetim paneli açılamadı. Microsoft Edge WebView2 Runtime kurulu olmalı.\n"+ex.Message,
              "Turkuaz 3D Web",MessageBoxButtons.OK,MessageBoxIcon.Error);
        }
    }
}
