using System.Diagnostics;
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
    private const string Url = "https://turkuaz3d.com/yonetim/?mode=windows";

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
        Shown += async (_,_) => await LoadEditor();
    }

    private async Task LoadEditor()
    {
        try
        {
            await view.EnsureCoreWebView2Async();
            view.CoreWebView2.Settings.AreDevToolsEnabled = false;
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
